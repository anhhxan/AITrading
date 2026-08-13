import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PaperExecutionEngine } from '../../engine/execution/PaperExecutionEngine';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { TradePlanEvent } from '../../engine/risk/RiskEngine';

describe('Paper Execution Engine', () => {
  let engine: PaperExecutionEngine;
  const supabase = getSupabaseAdmin();
  let testRobotId = '';

  beforeAll(async () => {
    engine = new PaperExecutionEngine();
    await engine.initialize();
  });

  afterAll(async () => {
    await engine.shutdown();
  });

  beforeEach(async () => {
    // 1. Clean up and create a test robot
    const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
    if (!user) throw new Error("No user found in DB to own test robot");

    const { data: robot } = await supabase.from('robots').insert({
      name: 'Paper Exec Test Robot',
      slug: `paper-test-${Date.now()}`,
      user_id: user.user_id,
      trading_mode: 'PAPER',
      trading_enabled: false,
      status: 'CREATED',
      current_state: 'READY_TO_ENTER',
      timeframe: '15m',
      signal_source: 'TRADINGVIEW',
      trading_view_symbol: 'BINANCE:BTCUSDT',
      execution_symbol: 'BTCUSDT',
      provider: 'BINANCE',
      trading_session: '24/7',
      paper_balance: 10000
    }).select('id').single();

    testRobotId = robot!.id;
  });

  afterEach(async () => {
    // Clean up all execution data
    await supabase.from('active_positions').delete().eq('robot_id', testRobotId);
    await supabase.from('active_orders').delete().eq('robot_id', testRobotId);
    await supabase.from('execution_intents').delete().eq('robot_id', testRobotId);
    await supabase.from('robots').delete().eq('id', testRobotId);
  });

  it('G. LONG test & E2E insertions', async () => {
    let positionOpenedFired = false;
    const unsub = coreEventBus.subscribe('POSITION_OPENED_EVENT', async (e: any) => {
       if (e.robotId === testRobotId) positionOpenedFired = true;
    });

    const trace = EventFactory.createTrace('corr1', 'parent1', 'test', 1);
    const event = EventFactory.createEvent<Omit<TradePlanEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'TRADE_PLAN_EVENT', testRobotId, 1, trace, {
      strategyId: 'BB',
      strategyVersion: '1.0',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      triggerPrice: 3400,
      entryReferencePrice: 3400,
      stopLoss: 3380,
      takeProfit: 3440,
      accountBalance: 10000,
      riskPercent: 0.01,
      riskAmount: 100,
      maxAllocationPercent: 0.2,
      positionSize: 100,
      leverage: 1,
      riskRewardRatio: 2,
      indicatorReference: { name: 'BB', config: {}, snapshot: {} }
    });

    await coreEventBus.publish(event as any);

    // Wait a bit for async DB writes
    await new Promise(r => setTimeout(r, 1500));

    // Verify
    const { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', testRobotId);
    expect(intents?.length).toBe(1);
    expect(intents![0].action).toBe('OPEN_LONG');
    expect(intents![0].symbol).toBe('BTCUSDT');

    const { data: orders } = await supabase.from('active_orders').select('*').eq('robot_id', testRobotId);
    expect(orders?.length).toBe(1);
    expect(orders![0].side).toBe('BUY');
    expect(orders![0].client_order_id).toBe(intents![0].client_order_id);

    const { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(positions?.length).toBe(1);
    expect(positions![0].side).toBe('LONG');
    expect(positions![0].entry_price).toBe(3400);

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot?.paper_balance).toBe(10000); // K. Balance unchanged

    expect(positionOpenedFired).toBe(true);

    unsub();
  });

  it('H. SHORT test', async () => {
    const trace = EventFactory.createTrace('corr2', 'parent2', 'test', 1);
    const event = EventFactory.createEvent<Omit<TradePlanEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'TRADE_PLAN_EVENT', testRobotId, 1, trace, {
      strategyId: 'BB',
      strategyVersion: '1.0',
      symbol: 'ETHUSDT',
      direction: 'SHORT',
      triggerPrice: 2000,
      entryReferencePrice: 2000,
      stopLoss: 2100,
      takeProfit: 1900,
      accountBalance: 10000,
      riskPercent: 0.01,
      riskAmount: 100,
      maxAllocationPercent: 0.2,
      positionSize: 50,
      leverage: 1,
      riskRewardRatio: 1,
      indicatorReference: { name: 'BB', config: {}, snapshot: {} }
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 1500));

    const { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', testRobotId);
    expect(intents?.length).toBe(1);
    expect(intents![0].action).toBe('OPEN_SHORT');

    const { data: orders } = await supabase.from('active_orders').select('*').eq('robot_id', testRobotId);
    expect(orders?.length).toBe(1);
    expect(orders![0].side).toBe('SELL');

    const { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(positions?.length).toBe(1);
    expect(positions![0].side).toBe('SHORT');
  });

  it('I. Duplicate event test', async () => {
    const trace = EventFactory.createTrace('corr3', 'parent3', 'test', 1);
    const event = EventFactory.createEvent<Omit<TradePlanEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'TRADE_PLAN_EVENT', testRobotId, 1, trace, {
      strategyId: 'BB',
      strategyVersion: '1.0',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      triggerPrice: 3400,
      entryReferencePrice: 3400,
      stopLoss: 3380,
      takeProfit: 3440,
      accountBalance: 10000,
      riskPercent: 0.01,
      riskAmount: 100,
      maxAllocationPercent: 0.2,
      positionSize: 100,
      leverage: 1,
      riskRewardRatio: 2,
      indicatorReference: { name: 'BB', config: {}, snapshot: {} }
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 1000));
    await coreEventBus.publish(event as any); // Send exact same event again
    await new Promise(r => setTimeout(r, 1000));

    const { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', testRobotId);
    expect(intents?.length).toBe(1);

    const { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(positions?.length).toBe(1);
  });

  it('J. LIVE safety test', async () => {
    await supabase.from('robots').update({ trading_mode: 'LIVE' }).eq('id', testRobotId);

    const trace = EventFactory.createTrace('corr4', 'parent4', 'test', 1);
    const event = EventFactory.createEvent<Omit<TradePlanEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'TRADE_PLAN_EVENT', testRobotId, 1, trace, {
      strategyId: 'BB',
      strategyVersion: '1.0',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      triggerPrice: 3400,
      entryReferencePrice: 3400,
      stopLoss: 3380,
      takeProfit: 3440,
      accountBalance: 10000,
      riskPercent: 0.01,
      riskAmount: 100,
      maxAllocationPercent: 0.2,
      positionSize: 100,
      leverage: 1,
      riskRewardRatio: 2,
      indicatorReference: { name: 'BB', config: {}, snapshot: {} }
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 1000));

    const { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', testRobotId);
    expect(intents?.length).toBe(0); // Should be rejected

    const { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(positions?.length).toBe(0);
  });
});
