import * as http from 'http';
import { RuntimeManager } from './RuntimeManager';
import { CommandPoller } from './CommandPoller';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { EntrySignalSchema } from '../core/contracts/EntrySignal';
import { FileIdempotencyManager, IIdempotencyManager } from '../core/infrastructure/IdempotencyManager';
import { coreEventBus } from '../core/infrastructure/EventBus';

export class WorkerHttpServer {
    private server: http.Server;
    private supabase = getSupabaseAdmin();
    private idempotency: IIdempotencyManager;

    constructor(private runtimeManager: RuntimeManager, private poller: CommandPoller) {
        // Fallback to Mock Idempotency Manager for Paper/Test (since Redis is missing)
        this.idempotency = new FileIdempotencyManager();
        
        this.server = http.createServer(async (req, res) => {
            if (req.method === 'POST' && req.url?.startsWith('/api/webhook/tv_direct/')) {
                const robotSlug = req.url.split('/').pop();
                if (!robotSlug) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ status: 'REJECTED', reason: 'Missing robot_slug' }));
                    return;
                }

                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                    if (body.length > 102400) { 
                        res.writeHead(413);
                        res.end(JSON.stringify({ status: 'REJECTED', reason: 'Payload too large' }));
                        req.connection.destroy();
                    }
                });

                req.on('end', async () => {
                    try {
                        const rawPayload = JSON.parse(body);
                        const expectedSecret = process.env.TV_WEBHOOK_SECRET;
                        
                        if (expectedSecret && rawPayload.secret !== expectedSecret) {
                            res.writeHead(401);
                            res.end(JSON.stringify({ status: 'REJECTED', reason: 'Unauthorized' }));
                            return;
                        }

                        const validation = EntrySignalSchema.safeParse(rawPayload);
                        if (!validation.success) {
                            console.error('[WorkerHttpServer] Validation Failed:', validation.error.issues);
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'REJECTED', reason: 'Schema Validation Failed', details: validation.error.issues }));
                            return;
                        }

                        const payload = validation.data;

                        // 1. Resolve Robot & Config
                        const { data: robot, error: robotErr } = await this.supabase
                            .from('robots')
                            .select('id, current_state, provider, trading_view_symbol, execution_symbol, timeframe, paper_balance, risk_profile, is_archived, status, trading_mode, trading_account_id')
                            .eq('slug', robotSlug)
                            .eq('is_archived', false)
                            .single();

                        if (robotErr || !robot) {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'REJECTED', reason: 'ROBOT_NOT_FOUND' }));
                            return;
                        }

                        const robotId = robot.id;

                        // 2. Persistent Idempotency (Atomic Check)
                        const lock = await this.idempotency.acquireLock(payload.signal_id);
                        if (!lock.acquired) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'DUPLICATE', reason: 'Signal already processed or executing' }));
                            return;
                        }

                        // 3. Provider Routing
                        const provider = robot.provider || 'PAPER';
                        // In Phase 2, we enforce Paper execution only. If it was real, we would route to BinanceEngine.
                        const riskConfig = {
                            tradingViewSymbol: robot.trading_view_symbol,
                            executionSymbol: robot.execution_symbol,
                            timeframe: robot.timeframe,
                            accountBalance: robot.paper_balance,
                            positionAllocationPercent: robot.risk_profile?.position_allocation_percent || 10,
                            leverage: robot.risk_profile?.leverage || 1
                        };

                        // Check Active Position (mocked query for critical path)
                        const { count: activePosCount } = await this.supabase
                            .from('active_positions')
                            .select('id', { count: 'exact', head: true })
                            .eq('robot_id', robotId);

                        // 4. Evaluate Risk
                        const riskResult = await this.runtimeManager.riskEngine.evaluateDirectEntry(payload, riskConfig, activePosCount || 0);

                        if (riskResult.decision === 'REJECTED') {
                            await this.idempotency.updateState(payload.signal_id, 'FAILED');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'REJECTED', reason: riskResult.reason }));
                            return;
                        }

                        // 5. Execution
                        let executionEngine = this.runtimeManager.executionEngine; 
                        // Note: Mock/Paper Execution Engine
                        try {
                            const executionResult = { status: 'FAILED' } as any; // removed
                            
                            // Client Order ID strategy: `tv_${payload.signal_id}`
                            // SL/TP placement would happen immediately here in the adapter
                            
                            if (['FILLED', 'PARTIAL_FILL', 'PROTECTION_PENDING', 'EXECUTED'].includes(executionResult.status)) {
                                await this.idempotency.updateState(payload.signal_id, 'EXECUTED');
                                
                                // 6. Async Audit (Fire and Forget)
                                coreEventBus.publish({
                                    eventId: randomUUID(),
                                    eventType: 'DIRECT_EXECUTION_AUDIT',
                                    robotId: robotId,
                                    trace: { correlationId: payload.signal_id, sequence: Date.now() },
                                    payload: {
                                        signal_id: payload.signal_id,
                                        provider,
                                        riskResult,
                                        executionResult
                                    }
                                } as any).catch(e => console.error('Audit failed', e));

                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ status: 'ACCEPTED', message: 'Executed', fillPrice: executionResult.fillPrice, executionResult }));
                            } else {
                                await this.idempotency.updateState(payload.signal_id, 'FAILED');
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ status: 'REJECTED', reason: 'Execution Failed' }));
                            }
                        } catch (execErr: any) {
                            await this.idempotency.updateState(payload.signal_id, 'FAILED');
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'REJECTED', reason: 'Execution Timeout or Error', details: execErr.message }));
                        }
                    } catch (err: any) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ status: 'REJECTED', reason: 'Bad Request / JSON Parse Error' }));
                        console.error('[WorkerHttpServer] Error parsing webhook:', err.message);
                    }
                });
            } else if (req.method === 'POST' && req.url?.startsWith('/api/webhook/tv/')) {
                const robotId = req.url.split('/').pop();
                if (!robotId) {
                    res.writeHead(400);
                    res.end('Missing robotId');
                    return;
                }

                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                    if (body.length > 102400) { 
                        res.writeHead(413);
                        res.end('Payload too large');
                        req.connection.destroy();
                    }
                });

                req.on('end', async () => {
                    try {
                        const payload = JSON.parse(body);
                        const expectedSecret = process.env.TV_WEBHOOK_SECRET;
                        
                        if (expectedSecret && payload.secret !== expectedSecret) {
                            res.writeHead(401);
                            res.end('Unauthorized');
                            return;
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'received' }));

                        const commandId = randomUUID();
                        const correlationId = 'tv_' + commandId.substring(0, 16).replace(/-/g, '');

                        const cmd = {
                            command_id: commandId,
                            robot_id: robotId,
                            command_type: 'TV_SIGNAL',
                            status: 'PROCESSING',
                            result: payload,
                            correlation_id: correlationId,
                            worker_id: process.env.WORKER_ID || 'PAPER-WORKER-01'
                        };

                        await this.supabase.from('robot_commands').insert(cmd);
                        await this.poller.processCommand(cmd);

                    } catch (err: any) {
                        res.writeHead(400);
                        res.end('Bad Request');
                        console.error('[WorkerHttpServer] Error parsing webhook:', err.message);
                    }
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
    }

    public start(port: number) {
        this.server.listen(port, '0.0.0.0', () => {
            console.log('[WorkerHttpServer] Listening for direct webhooks on port ' + port);
        });
    }

    public stop() {
        this.server.close();
    }
}
