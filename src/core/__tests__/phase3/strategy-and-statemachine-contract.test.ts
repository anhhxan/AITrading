import { describe, it, expect, beforeEach } from 'vitest';
import { EventFactory, DecisionTrace } from '../../infrastructure/EventFactory';
import { StateMachineEngine, RobotState, StateTransitionEvent } from '../../engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';
import { StrategySignalEvent } from '../../engine/strategies/StrategyEngine';

describe('Phase 3 Contract: State Machine Rules', () => {
  let sm: StateMachineEngine;
  let publishedEvents: any[] = [];
  
  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    publishedEvents = [];
    
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => {
      publishedEvents.push(e);
    });
    

    sm = new StateMachineEngine();
    await sm.initialize();
    sm.registerRobot('test-robot', 3); // maxTimeout = 3
  });

  const createSignal = (direction: 'LONG' | 'SHORT' | 'NONE', correlationId: string, entryTrigger: any = null, sequence: number = 100): StrategySignalEvent => {
    const trace = EventFactory.createTrace(correlationId, `signal-${correlationId}`, 'StrategyEngine', sequence);
    return EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', 'test-robot', trace, {
      direction,
      maxTimeoutCandles: 3,
      entryTrigger,
      strategyId: 'BB_Strategy',
      strategyVersion: 'v1.0.0'
    }) as any;
  };

  const createCandle = (sequence: number, price: number) => {
    const trace = EventFactory.createTrace(`corr-${sequence}`, `parent-${sequence}`, 'MarketData', sequence);
    return EventFactory.createEvent('CANDLE_CLOSED', 'test-robot', trace, {
      candle: { close: price, timestamp: Date.now(), open: price, high: price, low: price, volume: 100 }
    });
  };

  it('T1: LONG -> WAIT_RETRACEMENT', async () => {
    const signal = createSignal('LONG', 'CORR-100', null, 100);
    await coreEventBus.publish(signal); // Simulate EventBus delivery
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_RETRACEMENT);
  });

  it('T2: SHORT -> WAIT_RETRACEMENT', async () => {
    const signal = createSignal('SHORT', 'CORR-101', null, 101);
    await coreEventBus.publish(signal);
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_RETRACEMENT);
  });

  it('T3: NONE -> no state change', async () => {
    const signal = createSignal('NONE', 'CORR-102', null, 102);
    await coreEventBus.publish(signal);
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_SIGNAL);
  });

  it('T4: New signal overrides old signal', async () => {
    const signal1 = createSignal('LONG', 'CORR-100', null, 100);
    await coreEventBus.publish(signal1);
    await coreEventBus.waitForIdle('test-robot');
    
    const candle101 = createCandle(101, 50000); // 1 timeout candle
    await coreEventBus.publish(candle101);
    await coreEventBus.waitForIdle('test-robot');
    
    // Now wait retracement with 1 timeout count.
    // Send a new signal:
    const signal2 = createSignal('SHORT', 'CORR-105', null, 102);
    await coreEventBus.publish(signal2);
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_RETRACEMENT);
    
    // Verify timeout is reset by sending 3 more candles and checking it doesn't timeout until the 4th
    await coreEventBus.publish(createCandle(103, 50000));
    await coreEventBus.publish(createCandle(104, 50000));
    await coreEventBus.publish(createCandle(105, 50000));
    await coreEventBus.waitForIdle('test-robot');
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_RETRACEMENT);
    
    await coreEventBus.publish(createCandle(106, 50000));
    await coreEventBus.waitForIdle('test-robot');
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_SIGNAL); // TIMEOUT
  });

  it('T5 & T8 & T9 & T10: Trigger -> READY_TO_ENTER with correct lineage', async () => {
    const signal = createSignal('LONG', 'CORR-100', { type: 'RETRACEMENT_ZONE', lower: 100, upper: 105 }, 100);
    await coreEventBus.publish(signal);
    await coreEventBus.waitForIdle('test-robot');
    
    const triggerCandle = createCandle(101, 102); // close=102, inside trigger zone
    await coreEventBus.publish(triggerCandle);
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.READY_TO_ENTER);
    
    expect(publishedEvents.length).toBe(1);
    const event = publishedEvents[0] as StateTransitionEvent;
    
    expect(event.eventType).toBe('STATE_TRANSITION_EVENT');
    expect(event.previousState).toBe(RobotState.WAIT_RETRACEMENT);
    expect(event.newState).toBe(RobotState.READY_TO_ENTER);
    expect(event.reason).toBe('TRIGGER_MATCHED');
    
    // Lineage check
    expect(event.trace.correlationId).toBe('CORR-100'); // T8
    expect(event.trace.parentId).toBe(triggerCandle.eventId); // T9
    expect(event.trace.sequence).toBe(101); // T10
  });

  it('T6: Trigger takes priority over Timeout', async () => {
    const signal = createSignal('LONG', 'CORR-100', { type: 'RETRACEMENT_ZONE', lower: 100, upper: 105 }, 100);
    await coreEventBus.publish(signal);
    await coreEventBus.waitForIdle('test-robot');
    
    await coreEventBus.publish(createCandle(101, 90)); // count=1
    await coreEventBus.publish(createCandle(102, 90)); // count=2
    await coreEventBus.publish(createCandle(103, 90)); // count=3
    await coreEventBus.waitForIdle('test-robot');
    
    // The 4th candle is the timeout boundary. If it triggers, it should trigger, not timeout.
    await coreEventBus.publish(createCandle(104, 102)); // inside zone
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.READY_TO_ENTER);
    expect(publishedEvents[0].newState).toBe(RobotState.READY_TO_ENTER);
  });

  it('T7: Timeout -> WAIT_SIGNAL', async () => {
    const signal = createSignal('LONG', 'CORR-100', { type: 'RETRACEMENT_ZONE', lower: 100, upper: 105 }, 100);
    await coreEventBus.publish(signal);
    await coreEventBus.waitForIdle('test-robot');
    
    await coreEventBus.publish(createCandle(101, 90)); // count=1
    await coreEventBus.publish(createCandle(102, 90)); // count=2
    await coreEventBus.publish(createCandle(103, 90)); // count=3
    await coreEventBus.publish(createCandle(104, 90)); // count=4 (Timeout)
    await coreEventBus.waitForIdle('test-robot');
    
    expect(sm.getState('test-robot')).toBe(RobotState.WAIT_SIGNAL);
    expect(publishedEvents[0].newState).toBe(RobotState.WAIT_SIGNAL);
    expect(publishedEvents[0].reason).toBe('TIMEOUT');
  });

  it('T8(Override Case): correlationId tracks new signal after override', async () => {
    const signal1 = createSignal('LONG', 'CORR-100', { type: 'RETRACEMENT_ZONE', lower: 100, upper: 105 }, 100);
    await coreEventBus.publish(signal1);
    await coreEventBus.waitForIdle('test-robot');
    
    await coreEventBus.publish(createCandle(101, 90));
    await coreEventBus.waitForIdle('test-robot');
    
    const signal2 = createSignal('SHORT', 'CORR-101', { type: 'RETRACEMENT_ZONE', lower: 50, upper: 60 }, 102);
    await coreEventBus.publish(signal2); // Override
    await coreEventBus.waitForIdle('test-robot');
    
    const triggerCandle = createCandle(103, 55); // Hits signal2's trigger
    await coreEventBus.publish(triggerCandle);
    await coreEventBus.waitForIdle('test-robot');
    
    expect(publishedEvents.length).toBe(1);
    const event = publishedEvents[0] as StateTransitionEvent;
    
    expect(event.trace.correlationId).toBe('CORR-101'); // Follows the overriding signal!
  });
});
