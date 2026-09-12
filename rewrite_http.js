const fs = require('fs');

const content = import * as http from 'http';
import { RuntimeManager } from './RuntimeManager';
import { CommandPoller } from './CommandPoller';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { EntrySignalSchema } from '../core/contracts/EntrySignal';

export class WorkerHttpServer {
    private server: http.Server;
    private supabase = getSupabaseAdmin();

    constructor(private runtimeManager: RuntimeManager, private poller: CommandPoller) {
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
                            console.error('[WorkerHttpServer] Validation Failed:', validation.error.errors);
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'REJECTED', reason: 'Schema Validation Failed', details: validation.error.errors }));
                            return;
                        }

                        const payload = validation.data;

                        const { data: robot, error: robotErr } = await this.supabase
                            .from('robots')
                            .select('id, current_state')
                            .eq('slug', robotSlug)
                            .eq('is_archived', false)
                            .single();

                        if (robotErr || !robot) {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'REJECTED', reason: 'ROBOT_NOT_FOUND' }));
                            return;
                        }

                        const robotId = robot.id;

                        console.log('[WorkerHttpServer] Received signal_id ' + payload.signal_id + ' for robot ' + robotId + ' (slug ' + robotSlug + ')');

                        if ((global as any).processedSignals?.has(payload.signal_id)) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ status: 'DUPLICATE', reason: 'Signal already processed' }));
                            return;
                        }
                        if (!(global as any).processedSignals) (global as any).processedSignals = new Set();
                        (global as any).processedSignals.add(payload.signal_id);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ACCEPTED', message: 'Signal queued for execution' }));

                        console.log('[WorkerHttpServer] Signal accepted, Phase 1 execution skipped.');

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
;

fs.writeFileSync('src/worker/HttpServer.ts', content);
