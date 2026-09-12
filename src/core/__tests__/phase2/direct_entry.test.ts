import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WorkerHttpServer } from '../../../../src/worker/HttpServer';
import { EntrySignal } from '../../../../src/core/contracts/EntrySignal';

vi.mock('@/lib/supabase', () => ({
    getSupabaseAdmin: vi.fn(() => ({
        from: (table: string) => ({
            select: () => ({
                eq: (field: string, val: any) => ({
                    eq: () => ({
                        single: async () => {
                            if (val === 'valid_robot') {
                                return { data: { id: 'uuid-1234', current_state: 'RUNNING', provider: 'PAPER', trading_view_symbol: 'BTCUSDT', execution_symbol: 'BTCUSDT', timeframe: '1m', paper_balance: 10000, risk_profile: { position_allocation_percent: 10, leverage: 1 }, is_archived: false, status: 'RUNNING', trading_mode: 'PAPER', trading_account_id: 'acc1' }, error: null };
                            }
                            if (val === 'binance_robot') {
                                return { data: { id: 'uuid-bina', provider: 'BINANCE', trading_view_symbol: 'BTCUSDT', execution_symbol: 'BTCUSDT', paper_balance: 10000 }, error: null };
                            }
                            if (val === 'exness_robot') {
                                return { data: { id: 'uuid-exne', provider: 'EXNESS', trading_view_symbol: 'BTCUSDT', execution_symbol: 'BTCUSDT', paper_balance: 10000 }, error: null };
                            }
                            if (val === 'risk_reject_robot') {
                                return { data: { id: 'uuid-risk', provider: 'PAPER', trading_view_symbol: 'BTCUSDT', execution_symbol: 'BTCUSDT', paper_balance: 10 }, error: null };
                            }
                            if (val === 'open_pos_robot') {
                                return { data: { id: 'uuid-open', provider: 'PAPER', trading_view_symbol: 'BTCUSDT', execution_symbol: 'BTCUSDT', paper_balance: 10000 }, error: null };
                            }
                            return { data: null, error: { message: 'Not found' } };
                        }
                    })
                }),
                select: (q: any, opts: any) => ({
                    eq: async (field: string, val: any) => {
                        // Mock active_positions count
                        if (val === 'uuid-open') return { count: 1 };
                        return { count: 0 };
                    }
                })
            })
        })
    }))
}));

describe('Phase 2 - Direct Entry to Risk & Execution', () => {
    let server: WorkerHttpServer;
    const port = 8090;
    
    let mockRiskEvaluate = vi.fn();
    let mockExecute = vi.fn();
    
    beforeAll(() => {
        const mockPoller: any = { processCommand: async () => {} };
        const mockRuntimeManager: any = {
            riskEngine: {
                evaluateDirectEntry: mockRiskEvaluate
            },
            executionEngine: {
                executeDirectTradePlan: mockExecute
            }
        };
        
        server = new WorkerHttpServer(mockRuntimeManager, mockPoller);
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

    it('1. Valid LONG -> Risk PASS -> Executed', async () => {
        mockRiskEvaluate.mockResolvedValueOnce({ decision: 'READY', tradePlan: {} });
        mockExecute.mockResolvedValueOnce({ status: 'EXECUTED', fillPrice: 60000 });
        
        const payload: EntrySignal = {
            signal_id: 'sig_1', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        const json: any = await res.json();
        expect(res.status).toBe(200);
        expect(json.status).toBe('ACCEPTED');
        expect(mockExecute).toHaveBeenCalled();
    });

    it('2. Valid SHORT', async () => {
        mockRiskEvaluate.mockResolvedValueOnce({ decision: 'READY', tradePlan: {} });
        mockExecute.mockResolvedValueOnce({ status: 'EXECUTED', fillPrice: 60000 });
        
        const payload: EntrySignal = {
            signal_id: 'sig_2', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'SHORT', entry_type: 'MARKET', entry_price: 60000, stop_loss: 61000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        expect(res.status).toBe(200);
    });

    it('3. Risk REJECT (e.g. low balance)', async () => {
        mockRiskEvaluate.mockResolvedValueOnce({ decision: 'REJECTED', reason: 'INVALID_ACCOUNT_BALANCE' });
        
        const payload: EntrySignal = {
            signal_id: 'sig_3', robot_slug: 'risk_reject_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('risk_reject_robot', payload);
        const json: any = await res.json();
        expect(json.status).toBe('REJECTED');
        expect(json.reason).toBe('INVALID_ACCOUNT_BALANCE');
    });

    it('4. Duplicate signal', async () => {
        // sig_1 was already processed in Test 1
        const payload: EntrySignal = {
            signal_id: 'sig_1', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        const json: any = await res.json();
        expect(json.status).toBe('DUPLICATE');
    });

    it('5. Execution Reject', async () => {
        mockRiskEvaluate.mockResolvedValueOnce({ decision: 'READY', tradePlan: {} });
        mockExecute.mockResolvedValueOnce({ status: 'REJECTED' });
        
        const payload: EntrySignal = {
            signal_id: 'sig_exec_rej', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        expect(res.status).toBe(500);
    });
    
    it('6. Execution Timeout/Throw', async () => {
        mockRiskEvaluate.mockResolvedValueOnce({ decision: 'READY', tradePlan: {} });
        mockExecute.mockRejectedValueOnce(new Error('Network Timeout'));
        
        const payload: EntrySignal = {
            signal_id: 'sig_exec_to', robot_slug: 'valid_robot', strategy: 'BB', symbol: 'BTCUSDT', timeframe: '1m', side: 'LONG', entry_type: 'MARKET', entry_price: 60000, stop_loss: 59000, signal_timestamp: 123, config_version: 1
        };
        const res = await sendSignal('valid_robot', payload);
        expect(res.status).toBe(500);
    });
});
