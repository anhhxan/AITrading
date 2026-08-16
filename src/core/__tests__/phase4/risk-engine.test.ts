import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RiskEngine, RiskConfig } from '../../engine/risk/RiskEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';
import { RobotState } from '../../engine/runtime/StateMachineEngine';

describe('Phase 4A: Risk Engine (TDD)', () => {
  let engine: RiskEngine;
  const robotId = 'RobotR1';

  const defaultRiskConfig: RiskConfig = {
    tradingViewSymbol: 'BTCUSDT',
    executionSymbol: 'BTCUSDT',
    timeframe: '15m',
    accountBalance: 10000,
    positionAllocationPercent: 20,
    
    leverage: 1
  };

  const createSignal = (direction: 'LONG' | 'SHORT', line1: number, line3: number, line5: number, seq: number = 22) => {
    return EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1 /* configVersion */, EventFactory.createTrace(`corr-${seq}`, 'ind-event', 'strat', seq), {
      direction,
      maxTimeoutCandles: 3,
      strategyId: 'BB_Strategy',
      strategyVersion: 'v1.0.0',
      indicatorReference: {
        name: 'BB_MB',
        config: { length: 20, source: 'close', mult: 2, mult2: 1 },
        snapshot: { line1, line2: line1 - 1, line3, line4: line5 + 1, line5 }
      }
    });
  };

  const createReadyToEnter = (triggerPrice: number, seq: number = 23) => {
    return EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, 1 /* configVersion */, EventFactory.createTrace('corr-22', `candle-${seq}`, 'fsm', seq), {
      previousState: RobotState.WAIT_RETRACEMENT,
      newState: RobotState.READY_TO_ENTER,
      reason: 'TRIGGER_MATCHED',
      triggerPrice
    });
  };

  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    engine = new RiskEngine();
    await engine.initialize();
    engine.registerRobotConfig(robotId, { ...defaultRiskConfig });
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  const sendFlow = async (signalEvent: any, transitionEvent: any): Promise<{tradePlan: any, rejected: any}> => {
    let tradePlan = null;
    let rejected = null;
    
    coreEventBus.subscribe('TRADE_PLAN_EVENT', (e: any) => tradePlan = e);
    coreEventBus.subscribe('RISK_REJECTED_EVENT', (e: any) => rejected = e);

    await coreEventBus.publish(signalEvent);
    await coreEventBus.publish(transitionEvent);
    await coreEventBus.waitForIdle(robotId);
    
    return { tradePlan, rejected };
  };

  it('T1: LONG SL = Line 5', async () => {
    const { tradePlan, rejected } = await sendFlow(
      createSignal('LONG', 110, 100, 90),
      createReadyToEnter(99)
    );
    expect(rejected).toBeNull();
    expect(tradePlan).not.toBeNull();
    expect(tradePlan.stopLoss).toBe(90);
  });

  it('T2: SHORT SL = Line 1', async () => {
    const { tradePlan, rejected } = await sendFlow(
      createSignal('SHORT', 110, 100, 90),
      createReadyToEnter(101)
    );
    expect(rejected).toBeNull();
    expect(tradePlan).not.toBeNull();
    expect(tradePlan.stopLoss).toBe(110);
  });

  it('T3: LONG TP = Line 3', async () => {
    const { tradePlan } = await sendFlow(
      createSignal('LONG', 110, 100, 90),
      createReadyToEnter(95)
    );
    expect(tradePlan.takeProfit).toBe(100);
  });

  it('T4: SHORT TP = Line 3', async () => {
    const { tradePlan } = await sendFlow(
      createSignal('SHORT', 110, 100, 90),
      createReadyToEnter(105)
    );
    expect(tradePlan.takeProfit).toBe(100);
  });

  it('T5: Entry = triggerPrice', async () => {
    const { tradePlan } = await sendFlow(
      createSignal('LONG', 110, 100, 90),
      createReadyToEnter(99.5)
    );
    expect(tradePlan.entryReferencePrice).toBe(99.5);
  });

  it('T6: Position sizing LONG', async () => {
    // Balance: 10000, Risk: 1% -> RiskAmount = 100
    // Entry = 95, SL = 90 -> riskPerUnit = 5
    // posSize = 100 / 5 = 20
    const { tradePlan } = await sendFlow(
      createSignal('LONG', 110, 100, 90),
      createReadyToEnter(95)
    );
    expect(tradePlan.riskAmount).toBe(100);
    expect(tradePlan.positionSize).toBe(20);
  });

  it('T7: Position sizing SHORT', async () => {
    // Balance: 10000, Risk: 1% -> RiskAmount = 100
    // Entry = 100, SL = 105 -> riskPerUnit = 5
    // posSize = 100 / 5 = 20. Notional = 20 * 100 = 2000 (<= 2000 limit)
    const { tradePlan } = await sendFlow(
      createSignal('SHORT', 105, 95, 90),
      createReadyToEnter(100)
    );
    expect(tradePlan.riskAmount).toBe(100);
    expect(tradePlan.positionSize).toBe(20);
  });

  it('T8: Allocation cap (REDUCE)', async () => {
    // Balance 10000. MaxAlloc 20% -> 2000
    // Signal LONG. Entry = 100, SL = 99 -> riskPerUnit = 1. RiskAmount = 100.
    // posSize = 100 / 1 = 100.
    // notional = 100 * 100 = 10000 > 2000 (Exceeds Max Allocation)
    // Reduce posSize to 2000 / 100 = 20.
    const { tradePlan } = await sendFlow(
      createSignal('LONG', 110, 105, 99),
      createReadyToEnter(100)
    );
    expect(tradePlan.positionSize).toBe(20);
  });

  it('T9: Risk rejection (Missing config)', async () => {
    engine.registerRobotConfig('RobotMissing', undefined as any);
    
    let rejected = null;
    coreEventBus.subscribe('RISK_REJECTED_EVENT', (e: any) => rejected = e);

    await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', 'RobotMissing', 1 /* configVersion */, EventFactory.createTrace('c1', 'p1', 's', 1), {
      direction: 'LONG', indicatorReference: { name: 'BB', snapshot: { line5: 90, line3: 100 } }
    }));
    await coreEventBus.publish(EventFactory.createEvent('STATE_TRANSITION_EVENT', 'RobotMissing', 1 /* configVersion */, EventFactory.createTrace('c1', 'p1', 'fsm', 2), {
      newState: RobotState.READY_TO_ENTER, triggerPrice: 95
    }));
    await coreEventBus.waitForIdle('RobotMissing');

    expect(rejected).not.toBeNull();
    expect((rejected as any).reason).toBe('MISSING_CONFIG');
  });

  it('T10: Wrong-side SL rejection', async () => {
    // SL = 100, Entry = 95 for LONG. SL > Entry is wrong.
    const { rejected } = await sendFlow(
      createSignal('LONG', 120, 110, 100),
      createReadyToEnter(95)
    );
    expect(rejected).not.toBeNull();
    expect(rejected.reason).toBe('INVALID_RISK_REWARD');
  });

  it('T11: Invalid TP (reward <= 0) rejection', async () => {
    // LONG: Entry = 105, TP = 100. Reward = -5 <= 0.
    const { rejected } = await sendFlow(
      createSignal('LONG', 110, 100, 90),
      createReadyToEnter(105)
    );
    expect(rejected).not.toBeNull();
    expect(rejected.reason).toBe('INVALID_RISK_REWARD');
  });

  it('T12: Missing snapshot rejection', async () => {
    const signal: any = createSignal('LONG', 110, 100, 90);
    delete signal.indicatorReference;
    const { rejected } = await sendFlow(signal, createReadyToEnter(95));
    expect(rejected).not.toBeNull();
    expect(rejected.reason).toBe('MISSING_SNAPSHOT');
  });

  it('T13: NaN/Infinity rejection', async () => {
    const { rejected } = await sendFlow(
      createSignal('LONG', 110, 100, NaN),
      createReadyToEnter(95)
    );
    expect(rejected).not.toBeNull();
    expect(rejected.reason).toBe('INVALID_SL');
  });

  it('T14: Trace preservation', async () => {
    const readyEvent = createReadyToEnter(95, 23);
    const { tradePlan } = await sendFlow(
      createSignal('LONG', 110, 100, 90, 22), // sequence 22
      readyEvent // sequence 23
    );
    expect(tradePlan.trace.correlationId).toBe('corr-22');
    expect(tradePlan.trace.parentId).toBe(readyEvent.eventId);
    expect(tradePlan.trace.sequence).toBe(23);
  });

  it('T15: Cross-candle snapshot preservation', async () => {
    const { tradePlan } = await sendFlow(
      createSignal('LONG', 110, 100, 90), // Signal originally has line5 = 90
      createReadyToEnter(95) // transition uses snapshot
    );
    expect(tradePlan.indicatorReference.snapshot.line5).toBe(90);
  });

  it('T16: Deterministic same-input same-output', async () => {
    const res1 = await sendFlow(
      createSignal('LONG', 110, 100, 90, 22),
      createReadyToEnter(95, 23)
    );
    
    // Simulate completely new events with different IDs and sequences but same state
    const res2 = await sendFlow(
      createSignal('LONG', 110, 100, 90, 24),
      createReadyToEnter(95, 25)
    );

    expect(JSON.stringify(res1.tradePlan.positionSize)).toBe(JSON.stringify(res2.tradePlan.positionSize));
  });
});
