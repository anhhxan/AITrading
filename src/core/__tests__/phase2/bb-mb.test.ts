import { describe, it, expect } from 'vitest';
import { PluginLoader } from '../../engine/runtime/PluginLoader';
import { Candle } from '../../interfaces/PluginInterfaces';

const createMockCandle = (price: number): Candle => ({
  timestamp: Date.now(),
  open: price,
  high: price,
  low: price,
  close: price,
  volume: 1000
});

describe('Phase 2: BB_MB Plugin Warmup & Logic', () => {
  it('Test B: Warmup Logic (NOT_READY -> READY)', () => {
    const bb = PluginLoader.loadIndicator('BB_MB');
    bb.init({  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  });

    // 1 to 19 candles
    for (let i = 1; i <= 19; i++) {
      const result = PluginLoader.safeUpdate(bb, createMockCandle(100 + i));
      expect(result.ready).toBe(false);
    }

    // 20th candle
    const result20 = PluginLoader.safeUpdate(bb, createMockCandle(120));
    expect(result20.ready).toBe(true);
    expect(result20.line1).toBeDefined();
    expect(result20.line2).toBeDefined();
    expect(result20.line3).toBeDefined();
    expect(result20.line4).toBeDefined();
    expect(result20.line5).toBeDefined();
    expect(result20.line1).toBe(result20.UpperOuter);
    expect(result20.line2).toBe(result20.UpperInner);
    expect(result20.line3).toBe(result20.Middle);
    expect(result20.line4).toBe(result20.LowerInner);
    expect(result20.line5).toBe(result20.LowerOuter);

    // 21st candle
    const result21 = PluginLoader.safeUpdate(bb, createMockCandle(121));
    expect(result21.ready).toBe(true);
  });
});
