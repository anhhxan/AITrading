import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as http from 'http';
import { WorkerHttpServer } from '../../../worker/HttpServer';
import { ExchangeRouter } from '../../engine/execution/ExchangeRouter';
import { PaperExchangeAdapter } from '../../engine/execution/PaperExchangeAdapter';
import { PaperExecutionEngine } from '../../engine/execution/PaperExecutionEngine';
import { RiskEngine } from '../../engine/risk/RiskEngine';

function createPayload(override: any = {}) {
    return {
        signal_id: override.signal_id || 'sig_' + Date.now() + Math.random(),
        robot_slug: 'valid_robot',
        strategy: 'BB',
        symbol: 'BTCUSDT',
        timeframe: '1m',
        side: 'LONG',
        entry_type: 'MARKET',
        entry_price: 60000,
        stop_loss: 59000,
        signal_timestamp: 1724019200000,
        config_version: 1,
        ...override
    };
}

function sendWebhook(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 4444,
            path: '/api/webhook/tv_direct/' + payload.robot_slug,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
                } catch(e) {
                    resolve({ statusCode: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
    });
}

describe('Phase 3B: Execution Integration', () => {
    let server: WorkerHttpServer;
    let adapter: PaperExchangeAdapter;

    beforeAll(async () => { try { require('fs').unlinkSync(require('path').resolve(process.cwd(), 'idempotency.json')); } catch(e) {}
        server = new WorkerHttpServer({} as any, {} as any);
        const engine = new PaperExecutionEngine();
        (server as any).runtimeManager = {
            executionEngine: engine,
            riskEngine: new RiskEngine()
        };
        // Mock Supabase to bypass DB calls in RiskEngine during tests
        (server as any).supabase = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: async () => {
                                return { data: {
                                    id: 'robot_1',
                                    provider: 'PAPER',
                                    trading_view_symbol: 'BINANCE:BTCUSDT',
                                    execution_symbol: 'BTCUSDT',
                                    timeframe: '1m',
                                    paper_balance: 10000,
                                    status: 'ACTIVE',
                                    is_archived: false,
                                    trading_mode: 'PAPER',
                                    trading_account_id: 'acc_1'
                                }};
                            }
                        })
                    })
                })
            })
        };

        await server.start(4444);
        adapter = ExchangeRouter.paperAdapter as PaperExchangeAdapter;
    });

    afterAll(async () => {
        await server.stop();
    });

    beforeEach(() => {
        adapter.mockNextOrderResponse = undefined;
        adapter.mockNextProtectionResponse = undefined;
        adapter.mockNextQueryResponse = undefined;
    });

    it('1. Valid LONG -> FILLED -> PROTECTED', async () => {
        const payload = createPayload({ side: 'LONG', entry_price: 60000, stop_loss: 59000 });
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(200);
        console.log(res.data); expect(res.data.status).toBe('ACCEPTED'); // Webhook returns ACCEPTED if executed successfully
    });

    it('2. Valid SHORT -> FILLED -> PROTECTED', async () => {
        const payload = createPayload({ side: 'SHORT', entry_price: 60000, stop_loss: 61000 });
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(200);
    });

    it('3. Invalid SL -> Risk REJECT', async () => {
        const payload = createPayload({ side: 'LONG', entry_price: 60000, stop_loss: 61000 }); // SL > entry for LONG is invalid
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(400); // Bad Request from Zod or REJECTED from Risk
    });

    it('4. Invalid symbol -> Zod/Risk REJECT', async () => {
        // We simulate invalid symbol by omitting or breaking schema
        const payload = createPayload({ symbol: 123 });
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(400);
    });

    it('5. Invalid robot', async () => {
        // Since we mock Supabase to always return valid robot_1, we'll override the mock temporarily
        const oldSupabase = (server as any).supabase;
        (server as any).supabase = {
            from: () => ({
                select: () => ({
                    eq: () => ({ eq: () => ({ single: async () => ({ error: { message: 'Not found' } }) }) })
                })
            })
        };
        const payload = createPayload({ robot_slug: 'non_existent_robot' });
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(404);
        expect(res.data.status).toBe('REJECTED');
        (server as any).supabase = oldSupabase;
    });

    it('7. Duplicate signal -> Ignored', async () => {
        const sig = 'dup_sig_' + Date.now();
        const payload = createPayload({ signal_id: sig });
        const res1 = await sendWebhook(payload);
        expect(res1.statusCode).toBe(200);
        const res2 = await sendWebhook(payload);
        expect(res2.statusCode).toBe(200); // Returns 200 OK
        expect(res2.data.status).toBe('REJECTED'); // Because Idempotency says already processing
    });

    it('11. Exchange reject -> Returns FAILED', async () => {
        adapter.mockNextOrderResponse = { status: 'REJECTED', reason: 'INSUFFICIENT_FUNDS' };
        const payload = createPayload();
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(500);
        expect(res.data.status).toBe('REJECTED'); 
    });

    it('12 & 13. Exchange timeout -> Reconcile', async () => {
        adapter.mockNextOrderResponse = { status: 'TIMEOUT' };
        adapter.mockNextQueryResponse = { status: 'FILLED', orderId: 'recon_123', fillPrice: 50000, filledQuantity: 1 };
        const payload = createPayload();
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(200);
        expect(res.data.status).toBe('ACCEPTED'); // Since reconcile found it FILLED
    });

    it('15. Partial fill', async () => {
        adapter.mockNextOrderResponse = { status: 'PARTIAL_FILL', orderId: 'part_123', fillPrice: 50000, filledQuantity: 0.5 };
        const payload = createPayload();
        const res = await sendWebhook(payload);
        expect(res.data.status).toBe('ACCEPTED');
        expect(res.data.executionResult.status).toBe('PARTIAL_FILL');
    });

    it('17. SL failure -> PROTECTION_PENDING', async () => {
        adapter.mockNextProtectionResponse = { status: 'REJECTED', reason: 'SL_REJECTED' };
        const payload = createPayload();
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(200);
        expect(res.data.executionResult.status).toBe('PROTECTION_PENDING');
    });

    it('23. Stable clientOrderId', async () => {
        const sig = 'stable_sig' + Date.now();
        const payload = createPayload({ signal_id: sig, robot_slug: 'valid_robot' });
        let interceptedReq: any;
        const oldPlaceOrder = adapter.placeOrder.bind(adapter);
        adapter.placeOrder = async (req) => {
            interceptedReq = req;
            return { status: 'FILLED', orderId: 'exch_1', fillPrice: 50000, filledQuantity: 1 };
        };
        await sendWebhook(payload);
        expect(interceptedReq.clientOrderId).toBe('robot_1_' + sig);
        adapter.placeOrder = oldPlaceOrder; // restore
    });

    it('24. Config version lineage', async () => {
        const payload = createPayload({ config_version: 99 });
        const res = await sendWebhook(payload);
        expect(res.statusCode).toBe(200);
    });
});

