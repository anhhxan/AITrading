import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateMachineEngine, RobotState, StateTransitionEvent } from '../StateMachineEngine';
import { coreEventBus } from '../../../infrastructure/EventBus';
import { EventFactory } from '../../../infrastructure/EventFactory';

describe('StateMachineEngine - Retracement Limit Fill Phase 14D', () => {
  let engine: StateMachineEngine;
  let publishedEvents: any[] = [];

  beforeEach(async () => {
    coreEventBus['handlers'].clear();
    publishedEvents = [];
    
    // Intercept all events
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => {
      publishedEvents.push(e);
    });

    engine = new StateMachineEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  const runTest = async (
    name: string,
    direction: 'LONG' | 'SHORT',
    triggerLower: number,
    triggerUpper: number,
    candleOpen: number,
    candleHigh: number,
    candleLow: number,
    candleClose: number,
    expectedState: RobotState,
    expectedFillPrice?: number
  ) => {
    const robotId = `test_robot_${name}`;
    engine.registerRobot('robot-1', '1m');
    
    const trace = EventFactory.createTrace('test-correlation', 'parent-id', 'test', 0);
    const signalEvent = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
      direction: direction,
      maxTimeoutCandles: 3,
      entryTrigger: {
        type: 'RETRACEMENT_ZONE',
        lower: triggerLower,
        upper: triggerUpper
      }
    });

    await coreEventBus.publish(signalEvent as any);
    expect(engine.getState(robotId)).toBe(RobotState.WAIT_CANDLE_B_CONFIRMATION);

    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, trace, {
      candle: {
        open: candleOpen,
        high: candleHigh,
        low: candleLow,
        close: candleClose
      }
    });

    await coreEventBus.publish(candleEvent as any);
    await new Promise(r => setTimeout(r, 50)); 

    expect(engine.getState(robotId)).toBe(expectedState);

    if (expectedState === RobotState.READY_TO_ENTER && expectedFillPrice !== undefined) {
      const transition = publishedEvents.find(e => e.eventType === 'STATE_TRANSITION_EVENT' && e.newState === RobotState.READY_TO_ENTER);
      expect(transition).toBeDefined();
      expect(transition.triggerPrice).toBe(expectedFillPrice);
    }
  };

  // LONG
  it('1. LONG - Close inside zone', async () => {
    await runTest('long1', 'LONG', 100, 110, 120, 120, 105, 105, RobotState.READY_TO_ENTER, 110);
  });

  it('2. LONG - Wick hit from above', async () => {
    await runTest('long2', 'LONG', 100, 110, 120, 120, 105, 115, RobotState.READY_TO_ENTER, 110);
  });

  it('3. LONG - Gap down through zone', async () => {
    await runTest('long3', 'LONG', 100, 110, 105, 120, 95, 115, RobotState.READY_TO_ENTER, 105);
  });

  it('4. LONG - exact upper boundary', async () => {
    await runTest('long4', 'LONG', 100, 110, 120, 120, 110, 115, RobotState.READY_TO_ENTER, 110);
  });

  it('5. LONG - exact lower boundary', async () => {
    await runTest('long5', 'LONG', 100, 110, 120, 120, 100, 115, RobotState.READY_TO_ENTER, 110);
  });

  // SHORT
  it('6. SHORT - Close inside zone', async () => {
    await runTest('short6', 'SHORT', 100, 110, 90, 105, 90, 105, RobotState.READY_TO_ENTER, 100);
  });

  it('7. SHORT - Wick hit from below', async () => {
    await runTest('short7', 'SHORT', 100, 110, 90, 105, 90, 95, RobotState.READY_TO_ENTER, 100);
  });

  it('8. SHORT - Gap up through zone', async () => {
    await runTest('short8', 'SHORT', 100, 110, 105, 115, 95, 95, RobotState.READY_TO_ENTER, 105);
  });

  it('9. SHORT - exact upper boundary', async () => {
    await runTest('short9', 'SHORT', 100, 110, 90, 110, 90, 95, RobotState.READY_TO_ENTER, 100);
  });

  it('10. SHORT - exact lower boundary', async () => {
    await runTest('short10', 'SHORT', 100, 110, 90, 100, 90, 95, RobotState.READY_TO_ENTER, 100);
  });

});
