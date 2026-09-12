import { describe, it, expect } from 'vitest';
import { EntrySignalSchema } from '../../contracts/EntrySignal';

describe('Phase 1 - EntrySignal Schema Validation', () => {
    it('1. Valid LONG', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'LONG',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(true);
    });

    it('2. Valid SHORT', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'SHORT',
            entry_price: 60000,
            stop_loss: 61000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(true);
    });

    it('3. Missing signal_id', () => {
        const payload = {
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'LONG',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });

    it('4. Invalid side', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'INVALID_SIDE',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });

    it('5. Invalid symbol (missing)', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            timeframe: '1m',
            side: 'LONG',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });

    it('6. Invalid entry_price (negative)', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'LONG',
            entry_price: -60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });

    it('7. LONG invalid SL (SL >= Entry)', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'LONG',
            entry_price: 60000,
            stop_loss: 61000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });

    it('8. SHORT invalid SL (SL <= Entry)', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'SHORT',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });
    
    it('13. Invalid timestamp', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'LONG',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: -1,
            config_version: 1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });

    it('14. Invalid config_version', () => {
        const payload = {
            signal_id: 'test_123',
            robot_slug: 'btc_bot',
            strategy: 'BB',
            symbol: 'BTCUSDT',
            timeframe: '1m',
            side: 'LONG',
            entry_price: 60000,
            stop_loss: 59000,
            signal_timestamp: 1724019200000,
            config_version: -1
        };
        const res = EntrySignalSchema.safeParse(payload);
        expect(res.success).toBe(false);
    });
});

