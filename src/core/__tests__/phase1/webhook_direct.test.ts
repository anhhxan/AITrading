import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EntrySignal } from '../../../../src/core/contracts/EntrySignal';

vi.mock('@/lib/supabase', () => ({
    getSupabaseAdmin: vi.fn(() => ({}))
}));

import { WorkerHttpServer } from '../../../../src/worker/HttpServer';

describe('Phase 1 - Direct Webhook Endpoint', () => {
    let server: WorkerHttpServer;
    const port = 8089;
    
    beforeAll(() => { try { require('fs').unlinkSync(require('path').resolve(process.cwd(), 'idempotency.json')); } catch(e) {}
        const mockPoller: any = { processCommand: async () => {} };
        const mockRuntimeManager: any = { riskEngine: { evaluateDirectEntry: async () => ({ decision: 'ACCEPTED', tradePlan: {} }) }, executionEngine: { executeDirectTradePlan: async () => ({ status: 'EXECUTED', fillPrice: 60000 }) } };
        
        server = new WorkerHttpServer(mockRuntimeManager, mockPoller);
        
        (server as any).supabase = {
            from: () => ({
                select: () => ({
                    eq: (field: string, val: any) => ({
                        eq: () => ({
                            single: async () => {
                                if (val === 'valid_robot') {
                                    return { data: { id: 'uuid-1234', current_state: 'RUNNING' }, error: null };
                                }
                                return { data: null, error: { message: 'Not found' } };
                            }
                        })
                    })
                })
            })
        };
        server.start(port);
    });
    
    afterAll(() => {
        server.stop();
    });

    const sendSignal = async (slug: string, payload: any) => {
        return await fetch(`http://127.0.0.1:${port}/api/webhook/tv_direct/${slug}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    };

    it('9. Unknown robot', async () => {
        const payload: EntrySignal = {
            signal_id: 'test_unk', robot_slug: 'unknown_bot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('unknown_bot', payload);
        const json: any = await res.json();
        expect(res.status).toBe(404);
        expect(json.status).toBe('REJECTED');
        expect(json.reason).toBe('ROBOT_NOT_FOUND');
    });

    it('1. Valid LONG (ACCEPTED)', async () => {
        const payload: EntrySignal = {
            signal_id: 'test_valid', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        const json: any = await res.json();
        expect(res.status).toBe(200);
        expect(json.status).toBe('ACCEPTED');
    });

    it('10. Duplicate signal (DUPLICATE)', async () => {
        const payload: EntrySignal = {
            signal_id: 'test_valid', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        const json: any = await res.json();
        expect(res.status).toBe(200);
        expect(json.status).toBe('DUPLICATE');
    });
    
    it('11. Same signal retry (DUPLICATE)', async () => {
        const payload: EntrySignal = {
            signal_id: 'test_valid', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 124, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        const json: any = await res.json();
        expect(res.status).toBe(200);
        expect(json.status).toBe('DUPLICATE');
    });
    
    it('12. Different signal (ACCEPTED)', async () => {
        const payload: EntrySignal = {
            signal_id: 'test_diff', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'SHORT', entry_type: 'MARKET', entry_price: 61000, stop_loss: 62000, signal_timestamp: 125, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        const json: any = await res.json();
        expect(res.status).toBe(200);
        expect(json.status).toBe('ACCEPTED');
    });
});
