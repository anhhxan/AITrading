import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StrategyEngine } from '../../engine/strategies/StrategyEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';

describe('Phase 3: Strategy Signal Breakout', () => {
  let engine: StrategyEngine;

  beforeEach(async () => {
    engine = new StrategyEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('S1: StrategyEngine phát hiện SIGNAL_DETECTED (LONG) chuẩn xác', async () => {
    let signalFired = false;
    let signalSide = '';
    
    const unsub = coreEventBus.subscribe('SIGNAL_DETECTED', async (evt: any) => {
      signalFired = true;
      signalSide = evt.signalSide;
    });

    engine.registerRobot('RobotS1', 'BB_Strategy', { retracementZonePercent: 20 });

    const trace1 = EventFactory.createTrace('t1', 'p1', 'eng', 1);
    
    // Nến 1: Close nằm giữa B5 và B4 (chuẩn bị bứt phá)
    // Giá = 96, B5 = 90, B4 = 100
    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotS1', trace1, {
      candle: { timestamp: 1, open: 96, high: 96, low: 96, close: 96, volume: 1 }
    }) as any);
    
    await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotS1', trace1, {
      indicators: {
        BB_MB: { ready: true, band1: 150, band2: 130, band4: 100, band5: 90 }
      }
    }) as any);
    
    await coreEventBus.waitForIdle('RobotS1');
    expect(signalFired).toBe(false); // Chưa phá

    // Nến 2: Close vượt lên trên B4
    // Giá = 105
    const trace2 = EventFactory.createTrace('t2', 'p1', 'eng', 2);
    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotS1', trace2, {
      candle: { timestamp: 2, open: 105, high: 105, low: 105, close: 105, volume: 1 }
    }) as any);
    
    await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotS1', trace2, {
      indicators: {
        BB_MB: { ready: true, band1: 150, band2: 130, band4: 100, band5: 90 }
      }
    }) as any);
    
    await coreEventBus.waitForIdle('RobotS1');
    
    expect(signalFired).toBe(true);
    expect(signalSide).toBe('LONG');
    
    unsub();
  });
});
