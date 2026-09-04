import * as http from 'http';
import { RuntimeManager } from './RuntimeManager';
import { CommandPoller } from './CommandPoller';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export class WorkerHttpServer {
    private server: http.Server;
    private supabase = getSupabaseAdmin();

    constructor(private runtimeManager: RuntimeManager, private poller: CommandPoller) {
        this.server = http.createServer(async (req, res) => {
            if (req.method === 'POST' && req.url?.startsWith('/api/webhook/tv/')) {
                const robotId = req.url.split('/').pop();
                if (!robotId) {
                    res.writeHead(400);
                    res.end('Missing robotId');
                    return;
                }

                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                    if (body.length > 102400) { // 100KB limit
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

                        // Immediately respond to TV
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'received' }));

                        const commandId = randomUUID();
                        const correlationId = 'tv_' + commandId.substring(0, 16).replace(/-/g, '');

                        // Persist command ATOMICALLY as PROCESSING
                        const cmd = {
                            command_id: commandId,
                            robot_id: robotId,
                            command_type: 'TV_SIGNAL',
                            status: 'PROCESSING',
                            result: payload, // Store raw payload here for now, compatible with Poller
                            correlation_id: correlationId,
                            worker_id: process.env.WORKER_ID || 'PAPER-WORKER-01'
                        };

                        await this.supabase.from('robot_commands').insert(cmd);

                        // DIRECT PATH IN-PROCESS
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
            console.log(`[WorkerHttpServer] Listening for direct webhooks on port ${port}`);
        });
    }

    public stop() {
        this.server.close();
    }
}
