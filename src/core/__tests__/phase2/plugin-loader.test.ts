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

describe('Phase 2: Plugin Loader Lifecycle', () => {
  it('Test A: Load and Validate BB_MB Plugin', () => {
    // Unknown plugin
    expect(() => PluginLoader.loadIndicator('INVALID')).toThrow();

    // Valid parameters
    const bb1 = PluginLoader.loadIndicator('BB_MB');
    bb1.init({ length: 20, mult: 2.0 });
    expect(bb1.validate()).toBe(true);

    // Invalid parameters
    const bb2 = PluginLoader.loadIndicator('BB_MB');
    bb2.init({ length: -1 });
    expect(bb2.validate()).toBe(false);

    const bb3 = PluginLoader.loadIndicator('BB_MB');
    bb3.init({ mult: 0 });
    expect(bb3.validate()).toBe(false);
  });

  it('Test A2: Warmup via PluginLoader', () => {
    const bb = PluginLoader.loadIndicator('BB_MB');
    bb.init({ length: 20, mult: 2.0 });
    expect(bb.validate()).toBe(true);

    const historicalCandles: Candle[] = [];
    for (let i = 0; i < 20; i++) historicalCandles.push(createMockCandle(100));

    // Warmup
    PluginLoader.warmup(bb, historicalCandles);
    
    // Should be ready now
    const snapshot = bb.getSnapshot();
    expect(snapshot.ready).toBe(true);
  });
});
