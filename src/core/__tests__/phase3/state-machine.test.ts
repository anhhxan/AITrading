import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateMachineEngine, RobotState } from '../../engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

describe('Phase 3: State Machine Transition', () => {
  let engine: StateMachineEngine;

  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    engine = new StateMachineEngine();
    await engine.initialize();
    engine.registerRobot('robot-1', '1m'); // max 2 candles
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('SM1: Timeout nếu giá không hồi về (Retracement)', async () => {
    let timeoutFired = false;
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => { 
      if (e.reason === 'TIMEOUT') timeoutFired = true; 
    });

    let seq = 1;
    const createSeqTrace = () => EventFactory.createTrace('t', 'p', 'e', seq++);

    // Kích hoạt SIGNAL
    await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
      direction: 'LONG', maxTimeoutCandles: 2, entryTrigger: { type: 'RETRACEMENT_ZONE', lower: 90, upper: 92 }
    }) as any);
    await coreEventBus.waitForIdle('RobotSM');
    expect(engine.getState('RobotSM')).toBe(RobotState.WAIT_RETRACEMENT);

    // Đẩy Indicator (Indicator ko còn được dùng trực tiếp bởi StateMachine nữa, nhưng giữ để khớp Event Pipeline)
    await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
        indicators: { BB_MB: { band4: 100, band5: 90 } }
    }) as any);
    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
      candle: { close: 105 } // Giá vẫn ở 105, không hồi về zone [90, 92]
    }) as any);
    await coreEventBus.waitForIdle('RobotSM');

    // Đẩy nến 2
    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
      candle: { close: 106 }
    }) as any);
    await coreEventBus.waitForIdle('RobotSM');

    // Đẩy nến 3 -> Quá timeout (đặt maxTimeout = 2)
    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
      candle: { close: 107 }
    }) as any);
    await coreEventBus.waitForIdle('RobotSM');

    expect(timeoutFired).toBe(true);
    expect(engine.getState('RobotSM')).toBe(RobotState.WAIT_SIGNAL);
  });

  it('SM2: Success chuyển trạng thái sang READY_TO_ENTER', async () => {
    let readyFired = false;
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => { 
      if (e.newState === RobotState.READY_TO_ENTER) readyFired = true; 
    });

    let seq = 1;
    const createSeqTrace = () => EventFactory.createTrace('t', 'p', 'e', seq++);

    // Kích hoạt SIGNAL
    await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
      direction: 'LONG', maxTimeoutCandles: 2, entryTrigger: { type: 'RETRACEMENT_ZONE', lower: 90, upper: 92 }
    }) as any);
    
    // Đẩy Indicator
    await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
        indicators: { BB_MB: { band4: 100, band5: 90 } } // Zone: 90 đến 92 (20% của 10)
    }) as any);

    // Đẩy nến giá rớt xuống 91 (nằm trong Retracement Zone [90, 92])
    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotSM', 1 /* configVersion */, createSeqTrace(), {
      candle: { close: 91 }
    }) as any);
    
    await coreEventBus.waitForIdle('RobotSM');

    expect(readyFired).toBe(true);
    expect(engine.getState('RobotSM')).toBe(RobotState.READY_TO_ENTER);
  });
});
