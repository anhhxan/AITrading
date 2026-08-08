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
    expect(() => PluginLoader.loadAndInitializeIndicator('INVALID', {})).toThrow();

    // Valid parameters
    const bb1 = PluginLoader.loadAndInitializeIndicator('BB_MB', { length: 20, mult: 2.0 });
    expect(bb1.validate()).toBe(true);

    // Invalid parameters - should throw during initialization
    expect(() => PluginLoader.loadAndInitializeIndicator('BB_MB', { length: -1 })).toThrow(/configuration invalid/);
    expect(() => PluginLoader.loadAndInitializeIndicator('BB_MB', { mult: 0 })).toThrow(/configuration invalid/);
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
