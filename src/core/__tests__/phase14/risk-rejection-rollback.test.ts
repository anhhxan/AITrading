import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateMachineEngine, RobotState } from '../../engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

describe('Phase 14H - Risk Rejection Rollback', () => {
  let engine: StateMachineEngine;

  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    engine = new StateMachineEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('should transition from READY_TO_ENTER back to WAIT_SIGNAL upon RISK_REJECTED_EVENT and accept new signals', async () => {
    const robotId = 'rejection-robot';
    engine.registerRobot(robotId);

    // 1. Send Signal -> WAIT_RETRACEMENT
    let trace = EventFactory.createTrace('corr-1', 'parent-1', 'tester', 1);
    const signalEvent = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
      direction: 'LONG',
      entryTrigger: { type: 'RETRACEMENT_ZONE', lower: 64000, upper: 64020 }
    });
    
    await coreEventBus.publish(signalEvent as any);
    await coreEventBus.waitForIdle(robotId);
    
    expect(engine.getState(robotId)).toBe(RobotState.WAIT_RETRACEMENT);

    // 2. Trigger Retracement -> READY_TO_ENTER
    trace = EventFactory.createTrace('corr-1', 'parent-2', 'tester', 2);
    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, trace, {
      candle: { open: 64050, high: 64080, low: 64010, close: 64050, volume: 100, timestamp: Date.now() }
    });
    
    await coreEventBus.publish(candleEvent as any);
    await coreEventBus.waitForIdle(robotId);

    expect(engine.getState(robotId)).toBe(RobotState.READY_TO_ENTER);

    // 3. Emit RISK_REJECTED_EVENT
    trace = EventFactory.createTrace('corr-1', 'parent-3', 'tester', 3);
    const rejectEvent = EventFactory.createEvent('RISK_REJECTED_EVENT', robotId, 1, trace, {
      reason: 'INVALID_RISK_REWARD'
    });

    await coreEventBus.publish(rejectEvent as any);
    await coreEventBus.waitForIdle(robotId);

    // STATE MUST BE WAIT_SIGNAL
    expect(engine.getState(robotId)).toBe(RobotState.WAIT_SIGNAL);

    // 4. Test processing of a new Signal
    trace = EventFactory.createTrace('corr-2', 'parent-4', 'tester', 4);
    const signalEvent2 = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
      direction: 'SHORT',
      entryTrigger: { type: 'RETRACEMENT_ZONE', lower: 65000, upper: 65020 }
    });

    await coreEventBus.publish(signalEvent2 as any);
    await coreEventBus.waitForIdle(robotId);

    // STATE MUST BE WAIT_RETRACEMENT AGAIN (proving robot is not bricked)
    expect(engine.getState(robotId)).toBe(RobotState.WAIT_RETRACEMENT);
  });
});
