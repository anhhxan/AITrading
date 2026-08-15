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
    const bb1 = PluginLoader.loadAndInitializeIndicator('BB_MB', {  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  });
    expect(bb1.validate()).toBe(true);

    // Invalid parameters - should throw during initialization
    expect(() => PluginLoader.loadAndInitializeIndicator('BB_MB', { length: -1 })).toThrow(/ROBOT NOT READY/);
    expect(() => PluginLoader.loadAndInitializeIndicator('BB_MB', { mult: 0 })).toThrow(/ROBOT NOT READY/);
  });

  it('Test A2: Warmup via PluginLoader', () => {
    const bb = PluginLoader.loadIndicator('BB_MB');
    bb.init({  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  });
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
