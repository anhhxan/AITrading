import { describe, it, expect } from 'vitest';
import { MarketDataValidator } from '../../engine/market-data/MarketDataValidator';
import { OHLCV } from '../../engine/interfaces/IMarketDataProvider';
import fc from 'fast-check';

describe('MarketDataValidator Contract', () => {
  it('B1: Nên chặn nến có High bé hơn Max(Open, Close)', () => {
    const invalidCandle: OHLCV = { timestamp: 1000, open: 100, high: 90, low: 80, close: 95, volume: 10, isClosed: true };
    expect(MarketDataValidator.validateCandle(invalidCandle)).toBe(false);
  });

  it('B2: Nên chặn nến có Low lớn hơn Min(Open, Close)', () => {
    const invalidCandle: OHLCV = { timestamp: 1000, open: 100, high: 110, low: 105, close: 95, volume: 10, isClosed: true };
    expect(MarketDataValidator.validateCandle(invalidCandle)).toBe(false);
  });

  it('B3: Nên chặn nến có Volume âm', () => {
    const invalidCandle: OHLCV = { timestamp: 1000, open: 100, high: 110, low: 90, close: 95, volume: -1, isClosed: true };
    expect(MarketDataValidator.validateCandle(invalidCandle)).toBe(false);
  });

  it('B4: Nên chặn nến chưa đóng (isClosed = false)', () => {
    const invalidCandle: OHLCV = { timestamp: 1000, open: 100, high: 110, low: 90, close: 95, volume: 10, isClosed: false };
    expect(MarketDataValidator.validateCandle(invalidCandle)).toBe(false);
  });

  it('B5: Nên cho qua nến hợp lệ chuẩn', () => {
    const validCandle: OHLCV = { timestamp: 1000, open: 100, high: 110, low: 90, close: 105, volume: 100, isClosed: true };
    expect(MarketDataValidator.validateCandle(validCandle)).toBe(true);
  });

  it('Property-based Testing (Fuzzing): Luôn chặn nến rác', () => {
    fc.assert(
      fc.property(
        fc.record({
          timestamp: fc.integer(),
          open: fc.double({ min: 1, max: 100000 }),
          high: fc.double({ min: 1, max: 100000 }),
          low: fc.double({ min: 1, max: 100000 }),
          close: fc.double({ min: 1, max: 100000 }),
          volume: fc.double({ min: -100, max: 1000 }),
          isClosed: fc.boolean()
        }),
        (candle) => {
          const isValid = MarketDataValidator.validateCandle(candle);
          const shouldBeValid = 
            candle.high >= Math.max(candle.open, candle.close) &&
            candle.low <= Math.min(candle.open, candle.close) &&
            candle.volume >= 0 &&
            candle.isClosed;
            
          expect(isValid).toBe(shouldBeValid);
        }
      )
    );
  });
});
