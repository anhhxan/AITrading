import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndicatorEngine } from '../../engine/indicators/IndicatorEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';

describe('Phase 2: Indicator Warmup Test', () => {
  let engine: IndicatorEngine;

  beforeEach(async () => {
    engine = new IndicatorEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('W1: Không được emit INDICATOR_UPDATED nếu Indicator chưa đủ data (warmup)', async () => {
    let emittedCount = 0;
    
    // Listen for Indicator updates
    const unsub = coreEventBus.subscribe('INDICATOR_UPDATED', async (evt) => {
      emittedCount++;
    });

    // Register Robot with BB_MB (length: 20)
    engine.registerRobot('RobotW1', [{ name: 'BB_MB', params: {  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  } }]);

    // Emit 19 candles
    for (let i = 1; i <= 19; i++) {
      const trace = EventFactory.createTrace('test-corr', 'parent', 'test-engine', i);
      const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', 'RobotW1', 1 /* configVersion */, trace, {
        candle: { timestamp: i, open: 100, high: 105, low: 95, close: 100 + i, volume: 1000 }
      });
      await coreEventBus.publish(candleEvent as any);
    }
    
    // Wait for eventbus
    await coreEventBus.waitForIdle('RobotW1');
    
    // Assert 0 emitted
    expect(emittedCount).toBe(0);

    // Emit 20th candle
    const trace20 = EventFactory.createTrace('test-corr', 'parent', 'test-engine', 20);
    const candle20 = EventFactory.createEvent('CANDLE_CLOSED', 'RobotW1', 1 /* configVersion */, trace20, {
      candle: { timestamp: 20, open: 100, high: 105, low: 95, close: 120, volume: 1000 }
    });
    await coreEventBus.publish(candle20 as any);
    await coreEventBus.waitForIdle('RobotW1');

    // Should emit now because length == 20
    expect(emittedCount).toBe(1);
    
    unsub();
  });
});
