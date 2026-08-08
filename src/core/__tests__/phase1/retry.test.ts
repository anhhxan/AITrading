import { describe, it, expect, vi } from 'vitest';
import { MarketDataEngine } from '../../engine/market-data/MarketDataEngine';
import { IMarketDataProvider, OHLCV } from '../../engine/interfaces/IMarketDataProvider';

class MockProvider implements IMarketDataProvider {
  public connectCount = 0;
  
  async connect(): Promise<void> {
    this.connectCount++;
    throw new Error("Provider Connection Error");
  }
  subscribe(symbol: string, timeframe: string): void {}
  onCandleClosed(callback: (candle: OHLCV) => void): void {}
  onTick(callback: (price: number, timestamp: number) => void): void {}
  async disconnect(): Promise<void> {}
}

describe('Retry Policy Contract', () => {
  it('C1: Nên thử lại tối đa 10 lần trước khi Crash', async () => {
    const mockProvider = new MockProvider();
    const engine = new MarketDataEngine(mockProvider);
    
    // Ép thời gian backoff về 0 để test chạy nhanh
    const originalSetTimeout = global.setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return {} as any;
    });

    try {
      await engine.initialize();
      expect.fail("Nên throw error");
    } catch (e: any) {
      expect(e.message).toBe("Market Data connection failed after maximum retries.");
      expect(mockProvider.connectCount).toBe(10);
      expect(engine.healthCheck().status).toBe('ERROR');
    }

    vi.restoreAllMocks();
  });
});
