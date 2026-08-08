import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndicatorEngine } from '../../engine/indicators/IndicatorEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { PluginLoader } from '../../engine/runtime/PluginLoader';
import { Candle, IIndicator } from '../../interfaces/PluginInterfaces';

const createMockCandleEvent = (sequence: number): any => {
  const trace = EventFactory.createTrace('c', 'root', 'Market', sequence);
  const candle: Candle = { timestamp: Date.now(), open: 100, high: 100, low: 100, close: 100, volume: 100 };
  return EventFactory.createEvent('CANDLE_CLOSED', 'ROBOT_E', trace, { candle });
};

describe('Phase 2: IndicatorEngine Contract', () => {
  let engine: IndicatorEngine;

  beforeEach(async () => {
    coreEventBus.clearAll();
    engine = new IndicatorEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('Test E: IndicatorEngine emits INDICATOR_UPDATED_EVENT only when ALL ready', async () => {
    // We register BB_MB which requires 20 candles to be ready
    engine.registerRobot('ROBOT_E', [{ name: 'BB_MB', params: { length: 20, mult: 2.0 } }]);

    let emitCount = 0;
    coreEventBus.subscribe('INDICATOR_UPDATED', async () => { emitCount++; });

    // Send 19 candles -> should be NOT READY
    for (let i = 1; i <= 19; i++) {
      await coreEventBus.publish(createMockCandleEvent(i));
    }
    await coreEventBus.waitForIdle('ROBOT_E');
    expect(emitCount).toBe(0); // Not ready yet

    // Send 20th candle -> should be READY
    await coreEventBus.publish(createMockCandleEvent(20));
    await coreEventBus.waitForIdle('ROBOT_E');
    expect(emitCount).toBe(1); // 1 emit
  });

  it('Test F: Plugin Failure Isolation (BrokenPlugin does not crash Engine)', async () => {
    // Create a mock broken plugin
    class BrokenPlugin implements IIndicator {
      name = 'BROKEN';
      init() {}
      validate() { return true; }
      warmup() {}
      update(): Record<string, any> { throw new Error('Simulated Crash'); }
      getSnapshot(): Record<string, any> { return { ready: false }; }
    }

    // Override loader temporarily for this test
    const originalLoad = PluginLoader.loadIndicator;
    PluginLoader.loadIndicator = (name: string) => {
      if (name === 'BROKEN') return new BrokenPlugin();
      return originalLoad(name);
    };

    engine.registerRobot('ROBOT_E', [
      { name: 'BB_MB', params: { length: 2, mult: 2.0 } }, // ready after 2 candles
      { name: 'BROKEN', params: {} }
    ]);

    let emitCount = 0;
    coreEventBus.subscribe('INDICATOR_UPDATED', async () => { emitCount++; });

    // Send 3 candles
    for (let i = 1; i <= 3; i++) {
      await coreEventBus.publish(createMockCandleEvent(i));
    }
    await coreEventBus.waitForIdle('ROBOT_E');

    // Restore loader
    PluginLoader.loadIndicator = originalLoad;

    // Engine should NOT crash
    expect(engine.ready()).toBe(true);

    // emitCount should be 0 because BROKEN plugin always throws (returning ready: false)
    // so allReady is never true.
    expect(emitCount).toBe(0); 
  });
});
