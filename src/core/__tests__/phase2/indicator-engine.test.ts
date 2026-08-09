import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndicatorEngine } from '../../engine/indicators/IndicatorEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { PluginLoader } from '../../engine/runtime/PluginLoader';
import { Candle, IIndicator } from '../../interfaces/PluginInterfaces';

const createMockCandleEvent = (sequence: number, robotId: string = 'ROBOT_E'): any => {
  const trace = EventFactory.createTrace('c', 'root', 'Market', sequence);
  const candle: Candle = { timestamp: Date.now(), open: 100, high: 100, low: 100, close: 100, volume: 100 };
  return EventFactory.createEvent('CANDLE_CLOSED', robotId, 1 /* configVersion */, trace, { candle });
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
      update(): any { throw new Error('Simulated Crash'); }
      getSnapshot(): any { return { ready: false }; }
      shutdown() {}
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

  it('Test G: IndicatorEngine Trace and Sequence Inheritance', async () => {
    engine.registerRobot('ROBOT_G', [{ name: 'BB_MB', params: { length: 2, mult: 2.0 } }]);

    let capturedIndicator: any = null;
    coreEventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      capturedIndicator = e;
    });

    const candle1 = createMockCandleEvent(1, 'ROBOT_G');
    await coreEventBus.publish(candle1);
    await coreEventBus.waitForIdle('ROBOT_G');

    const candle2 = createMockCandleEvent(2, 'ROBOT_G');
    await coreEventBus.publish(candle2);
    await coreEventBus.waitForIdle('ROBOT_G');

    expect(capturedIndicator).not.toBeNull();
    // Trace checks
    expect(capturedIndicator.trace.sequence).toBe(2);
    expect(capturedIndicator.trace.parentId).toBe(candle2.eventId);
    expect(capturedIndicator.trace.correlationId).toBe(candle2.trace.correlationId);
  });

  it('Test H: Rapid Publish Regression - Causal Pipeline Ordering', async () => {
    engine.registerRobot('ROBOT_H', [{ name: 'BB_MB', params: { length: 2, mult: 2.0 } }]);

    const processingOrder: string[] = [];

    coreEventBus.subscribe('CANDLE_CLOSED', async (e) => {
      if (e.robotId === 'ROBOT_H') {
        processingOrder.push(`CANDLE${e.trace.sequence}`);
      }
    });

    coreEventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      if (e.robotId === 'ROBOT_H') {
        processingOrder.push(`INDICATOR${e.trace.sequence}`);
      }
    });

    // Publish 10 candles very fast (asynchronous fire-and-forget)
    for (let i = 1; i <= 10; i++) {
      const trace = EventFactory.createTrace('c', 'root', 'Market', i);
      const candle: Candle = { timestamp: Date.now(), open: 100, high: 100, low: 100, close: 100, volume: 100 };
      const evt = EventFactory.createEvent('CANDLE_CLOSED', 'ROBOT_H', 1 /* configVersion */, trace, { candle });
      await coreEventBus.publish(evt as any);
    }

    await coreEventBus.waitForIdle('ROBOT_H');

    // Expected order:
    // CANDLE1
    // CANDLE2
    // INDICATOR2 (since length = 2, ready starts at 2)
    // CANDLE3
    // INDICATOR3 ... up to 10
    const expected = ['CANDLE1', 'CANDLE2', 'INDICATOR2'];
    for (let i = 3; i <= 10; i++) {
      expected.push(`CANDLE${i}`);
      expected.push(`INDICATOR${i}`);
    }

    expect(processingOrder).toEqual(expected);
  });
});
