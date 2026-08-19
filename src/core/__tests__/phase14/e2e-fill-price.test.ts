import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateMachineEngine, RobotState } from '../../engine/runtime/StateMachineEngine';
import { RiskEngine } from '../../engine/risk/RiskEngine';
import { PaperExecutionEngine } from '../../engine/execution/PaperExecutionEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

describe('Phase 14H - E2E Fill Price', () => {
  let stateMachine: StateMachineEngine;
  let riskEngine: RiskEngine;
  let execEngine: PaperExecutionEngine;

  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    
    stateMachine = new StateMachineEngine();
    riskEngine = new RiskEngine();
    execEngine = new PaperExecutionEngine();

    await stateMachine.initialize();
    await riskEngine.initialize();
    
    // Mock the execEngine's supabase dependency by skipping the DB checks
    // We only need it to emit the intent and position events
    execEngine.initialize = async () => {
      // @ts-ignore
      execEngine.status = 'READY';
      // @ts-ignore
      execEngine.unsubs.push(coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e: any) => {
        // Mocking the PaperExecutionEngine's behavior directly to bypass Supabase
        const intentId = 'intent-123';
        const trace = EventFactory.createTrace(e.trace.correlationId, e.eventId, 'PaperExecutionEngine_1', e.trace.sequence);
        const intentEvent = EventFactory.createEvent('EXECUTION_INTENT_CREATED', e.robotId, 1, trace, {
          intentId,
          action: 'OPEN_POSITION',
          orderType: e.orderType,
          price: e.entryReferencePrice,
          positionSize: e.positionSize
        });
        await coreEventBus.publish(intentEvent as any);

        const trace2 = EventFactory.createTrace(e.trace.correlationId, intentEvent.eventId, 'PaperExecutionEngine_1', e.trace.sequence);
        const posEvent = EventFactory.createEvent('POSITION_OPENED_EVENT', e.robotId, 1, trace2, {
          symbol: e.executionSymbol,
          side: e.direction,
          quantity: e.positionSize,
          entryPrice: e.entryReferencePrice,
          stopLoss: e.stopLoss,
          takeProfit: e.takeProfit,
          leverage: e.leverage
        });
        await coreEventBus.publish(posEvent as any);
      }));
    };
    await execEngine.initialize();
  });

  afterEach(async () => {
    await stateMachine.shutdown();
    await riskEngine.shutdown();
    // @ts-ignore
    if (execEngine.shutdown) await execEngine.shutdown();
  });

  const runE2E = async (
    direction: 'LONG' | 'SHORT',
    open: number,
    high: number,
    low: number,
    close: number
  ) => {
    const robotId = 'e2e-robot';
    stateMachine.registerRobot(robotId);
    riskEngine.registerRobotConfig(robotId, {
      tradingViewSymbol: 'BINANCE:BTCUSDT',
      executionSymbol: 'BTCUSDT',
      timeframe: '1m',
      accountBalance: 10000,
      positionAllocationPercent: 2,
      leverage: 10
    });

    let transitionPrice = null;
    let riskEntryPrice = null;
    let intentPrice = null;
    let intentOrderType = null;
    let positionEntryPrice = null;

    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => {
      if (e.newState === RobotState.READY_TO_ENTER) {
        transitionPrice = e.triggerPrice;
      }
    });

    coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e: any) => {
      riskEntryPrice = e.entryReferencePrice;
    });

    coreEventBus.subscribe('EXECUTION_INTENT_CREATED', async (e: any) => {
      intentPrice = e.price;
      intentOrderType = e.orderType;
    });

    coreEventBus.subscribe('POSITION_OPENED_EVENT', async (e: any) => {
      positionEntryPrice = e.entryPrice;
    });

    let seq = 1;
    const trace = EventFactory.createTrace('corr-1', 'parent-1', 'tester', seq++);
    const signalEvent = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
      direction,
      entryTrigger: { type: 'RETRACEMENT_ZONE', lower: 64000, upper: 64020 },
      indicatorReference: { 
        snapshot: { 
          line1: 65000, // SHORT SL 
          line3: direction === 'LONG' ? 65000 : 63000, // TP
          line5: 63000  // LONG SL
        } 
      }
    });
    
    await coreEventBus.publish(signalEvent as any);
    await coreEventBus.waitForIdle(robotId);

    const cTrace = EventFactory.createTrace('corr-1', 'parent-2', 'tester', seq++);
    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, cTrace, {
      candle: { open, high, low, close, volume: 100, timestamp: Date.now() }
    });
    
    await coreEventBus.publish(candleEvent as any);
    await coreEventBus.waitForIdle(robotId);

    return {
      transitionPrice,
      riskEntryPrice,
      intentPrice,
      intentOrderType,
      positionEntryPrice
    };
  };

  it('LONG normal', async () => {
    const res = await runE2E('LONG', 64050, 64080, 64010, 64050);
    expect(res.transitionPrice).toBe(64020);
    expect(res.riskEntryPrice).toBe(64020);
    expect(res.intentPrice).toBe(64020);
    expect(res.intentOrderType).toBe('LIMIT');
    expect(res.positionEntryPrice).toBe(64020);
  });

  it('LONG open inside', async () => {
    const res = await runE2E('LONG', 64010, 64015, 64005, 64010);
    expect(res.transitionPrice).toBe(64010);
    expect(res.riskEntryPrice).toBe(64010);
    expect(res.intentPrice).toBe(64010);
    expect(res.intentOrderType).toBe('LIMIT');
    expect(res.positionEntryPrice).toBe(64010);
  });

  it('SHORT normal', async () => {
    const res = await runE2E('SHORT', 63900, 64010, 63850, 63900);
    expect(res.transitionPrice).toBe(64000);
    expect(res.riskEntryPrice).toBe(64000);
    expect(res.intentPrice).toBe(64000);
    expect(res.intentOrderType).toBe('LIMIT');
    expect(res.positionEntryPrice).toBe(64000);
  });

  it('SHORT open inside', async () => {
    const res = await runE2E('SHORT', 64010, 64015, 63990, 64010);
    expect(res.transitionPrice).toBe(64010);
    expect(res.riskEntryPrice).toBe(64010);
    expect(res.intentPrice).toBe(64010);
    expect(res.intentOrderType).toBe('LIMIT');
    expect(res.positionEntryPrice).toBe(64010);
  });
});
