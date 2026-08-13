import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { StateMachineEngine, RobotState, PositionOpenedEvent, PositionClosedEvent } from '../../engine/runtime/StateMachineEngine';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';
import { getSupabaseAdmin } from '../../../lib/supabase';

describe('Position Lifecycle State Machine', () => {
  let engine: StateMachineEngine;
  const supabase = getSupabaseAdmin();
  let testRobotId = '';

  beforeAll(async () => {
    engine = new StateMachineEngine();
    await engine.initialize();
  });

  afterAll(async () => {
    await engine.shutdown();
  });

  beforeEach(async () => {
    const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
    if (!user) throw new Error("No user found");

    const { data: robot } = await supabase.from('robots').insert({
      name: 'Position Lifecycle Test',
      slug: `pos-test-${Date.now()}`,
      user_id: user.user_id,
      trading_mode: 'PAPER',
      status: 'CREATED',
      current_state: 'READY_TO_ENTER',
      timeframe: '15m',
      signal_source: 'TRADINGVIEW',
      trading_view_symbol: 'BINANCE:BTCUSDT',
      execution_symbol: 'BTCUSDT',
      provider: 'BINANCE',
      trading_session: '24/7'
    }).select('id').single();

    testRobotId = robot!.id;
    engine.registerRobot(testRobotId);
    
    // Set to READY_TO_ENTER bypassing transition tests
    // Using internal states map is private, so we mock it by inserting DB then waiting? 
    // Actually engine.getState(testRobotId) starts at WAIT_SIGNAL because of registerRobot.
    // Let's publish a transition event or just set it by mocking. No, we can just transition it.
    // Wait, the DB has READY_TO_ENTER. The engine states map might not be synced on start unless we load it. 
    // StateMachineEngine doesn't load from DB in initialize() currently, it uses registerRobot -> WAIT_SIGNAL.
    // We can simulate the transition by sending CANDLE_CLOSED and STRATEGY_SIGNAL or just bypassing by calling a private method?
    // Let's use `as any` to set the state in the map for testing.
    (engine as any).states.set(testRobotId, RobotState.READY_TO_ENTER);
  });

  afterEach(async () => {
    await supabase.from('robots').delete().eq('id', testRobotId);
  });

  it('TEST A: READY_TO_ENTER + POSITION_OPENED_EVENT -> POSITION_OPEN', async () => {
    const trace = EventFactory.createTrace('corrA', 'parentA', 'test', 1);
    const event = EventFactory.createEvent<Omit<PositionOpenedEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'POSITION_OPENED_EVENT', testRobotId, 1, trace, {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 100,
      entryPrice: 3400,
      stopLoss: 3300,
      takeProfit: 3500,
      leverage: 1
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 500));

    expect(engine.getState(testRobotId)).toBe(RobotState.POSITION_OPEN);

    const { data: r } = await supabase.from('robots').select('current_state').eq('id', testRobotId).single();
    expect(r?.current_state).toBe('POSITION_OPEN');
  });

  it('TEST B: POSITION_OPEN + POSITION_CLOSED_EVENT -> WAIT_SIGNAL', async () => {
    (engine as any).states.set(testRobotId, RobotState.POSITION_OPEN);
    await supabase.from('robots').update({ current_state: 'POSITION_OPEN' }).eq('id', testRobotId);

    const trace = EventFactory.createTrace('corrB', 'parentB', 'test', 1);
    const event = EventFactory.createEvent<Omit<PositionClosedEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'POSITION_CLOSED_EVENT', testRobotId, 1, trace, {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 100,
      exitPrice: 3500,
      realizedPnl: 100,
      closeReason: 'TAKE_PROFIT'
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 500));

    expect(engine.getState(testRobotId)).toBe(RobotState.WAIT_SIGNAL);
    
    const { data: r } = await supabase.from('robots').select('current_state').eq('id', testRobotId).single();
    expect(r?.current_state).toBe('WAIT_SIGNAL');
  });

  it('TEST C: WAIT_SIGNAL + POSITION_OPENED_EVENT -> REJECT / IGNORE', async () => {
    (engine as any).states.set(testRobotId, RobotState.WAIT_SIGNAL);
    await supabase.from('robots').update({ current_state: 'WAIT_SIGNAL' }).eq('id', testRobotId);

    const trace = EventFactory.createTrace('corrC', 'parentC', 'test', 1);
    const event = EventFactory.createEvent<Omit<PositionOpenedEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'POSITION_OPENED_EVENT', testRobotId, 1, trace, {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 100,
      entryPrice: 3400,
      stopLoss: 3300,
      takeProfit: 3500,
      leverage: 1
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 500));

    expect(engine.getState(testRobotId)).toBe(RobotState.WAIT_SIGNAL);
    
    const { data: r } = await supabase.from('robots').select('current_state').eq('id', testRobotId).single();
    expect(r?.current_state).toBe('WAIT_SIGNAL'); // Should not change
  });

  it('TEST D: duplicate POSITION_OPENED_EVENT -> no side effect', async () => {
    (engine as any).states.set(testRobotId, RobotState.READY_TO_ENTER);
    await supabase.from('robots').update({ current_state: 'READY_TO_ENTER' }).eq('id', testRobotId);

    const trace = EventFactory.createTrace('corrD', 'parentD', 'test', 1);
    const event = EventFactory.createEvent<Omit<PositionOpenedEvent, keyof import('../../infrastructure/EventFactory').BaseEvent>>(
      'POSITION_OPENED_EVENT', testRobotId, 1, trace, {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 100,
      entryPrice: 3400,
      stopLoss: 3300,
      takeProfit: 3500,
      leverage: 1
    });

    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 500));

    expect(engine.getState(testRobotId)).toBe(RobotState.POSITION_OPEN);

    // Send exactly the same event again (the state is now POSITION_OPEN, which is an invalid state for OPENED event)
    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 500));

    expect(engine.getState(testRobotId)).toBe(RobotState.POSITION_OPEN); // Still POSITION_OPEN, didn't crash or regress
  });
});
