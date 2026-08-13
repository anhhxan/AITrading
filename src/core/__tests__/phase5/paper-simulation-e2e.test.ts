import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';

import { StrategyEngine, StrategySignalEvent } from '../../engine/strategies/StrategyEngine';
import { StateMachineEngine, RobotState } from '../../engine/runtime/StateMachineEngine';
import { RiskEngine } from '../../engine/risk/RiskEngine';
import { PaperExecutionEngine } from '../../engine/execution/PaperExecutionEngine';
import { PaperPositionTracker } from '../../engine/execution/PaperPositionTracker';
import { IndicatorUpdatedEvent } from '../../engine/indicators/IndicatorEngine';

describe('Paper Trading Simulation E2E (Money Flow Verification)', () => {
  const supabase = getSupabaseAdmin();
  let testRobotId = '';
  
  let strategyEngine: StrategyEngine;
  let stateMachine: StateMachineEngine;
  let riskEngine: RiskEngine;
  let executionEngine: PaperExecutionEngine;
  let tracker: PaperPositionTracker;

  beforeAll(async () => {
    strategyEngine = new StrategyEngine();
    stateMachine = new StateMachineEngine();
    riskEngine = new RiskEngine();
    executionEngine = new PaperExecutionEngine();
    tracker = new PaperPositionTracker();

    await strategyEngine.initialize();
    await stateMachine.initialize();
    await riskEngine.initialize();
    await executionEngine.initialize();
    await tracker.initialize();
  });

  afterAll(async () => {
    await strategyEngine.shutdown();
    await stateMachine.shutdown();
    await riskEngine.shutdown();
    await executionEngine.shutdown();
    await tracker.shutdown();
  });

  beforeEach(async () => {
    const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
    if (!user) throw new Error("No user found");

    const { data: robot } = await supabase.from('robots').insert({
      name: 'Money Flow Test',
      slug: `money-flow-${Date.now()}`,
      user_id: user.user_id,
      trading_mode: 'PAPER',
      trading_enabled: true,
      status: 'RUNNING',
      current_state: 'WAIT_SIGNAL',
      timeframe: '15m',
      signal_source: 'TRADINGVIEW',
      trading_view_symbol: 'BINANCE:BTCUSDT',
      execution_symbol: 'BTCUSDT',
      provider: 'BINANCE',
      trading_session: '24/7',
      paper_balance: 10000
    }).select('id').single();

    testRobotId = robot!.id;

    strategyEngine.registerRobot(testRobotId, 'BB_Strategy', { retracementZonePercent: 20, timeoutCandles: 3 });
    stateMachine.registerRobot(testRobotId);
    riskEngine.registerRobotConfig(testRobotId, {
      symbol: 'BTCUSDT',
      accountBalance: 10000,
      riskPercent: 1, // 1% risk per trade. At $10k, risk is $100.
      maxAllocationPercent: 100,
      leverage: 1
    });
  });

  afterEach(async () => {
    await supabase.from('trade_history').delete().eq('robot_id', testRobotId);
    await supabase.from('active_positions').delete().eq('robot_id', testRobotId);
    await supabase.from('active_orders').delete().eq('robot_id', testRobotId);
    await supabase.from('execution_intents').delete().eq('robot_id', testRobotId);
    await supabase.from('robots').delete().eq('id', testRobotId);
  });

  // Helper to emit candle closed
  async function emitCandle(high: number, low: number, close: number, timestamp: number = Date.now()) {
    const trace = EventFactory.createTrace('corr', 'parent', 'test', 1);
    const event = EventFactory.createEvent('CANDLE_CLOSED', testRobotId, 1, trace, {
      candle: { open: close, high, low, close, timestamp, volume: 100 }
    });
    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 1000)); // wait for event processing
  }

  // Helper to emit indicator updated
  async function emitIndicator(line1: number, line2: number, line3: number, line4: number, line5: number) {
    const trace = EventFactory.createTrace('corr', 'parent', 'test', 1);
    const event = EventFactory.createEvent('INDICATOR_UPDATED', testRobotId, 1, trace, {
      indicators: {
        BB_MB: { ready: true, line1, line2, line3, line4, line5, config: {} }
      }
    });
    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 1000));
  }

  it('Multi Trade Simulation', async () => {
    let currentBalance = 10000;

    // --- TRADE #1: LONG ENTRY -> TP ---
    
    // Initial candle to set previousClose
    await emitCandle(100, 80, 95);
    await emitIndicator(130, 120, 110, 100, 90);
    // Candle close is 95, between line4(100) and line5(90).
    expect(stateMachine.getState(testRobotId)).toBe(RobotState.WAIT_SIGNAL);

    // Candle to trigger signal (Break above line4)
    await emitCandle(115, 95, 105);
    await emitIndicator(130, 120, 110, 100, 90);
    // Candle close is 105, above line4(100). Signal LONG!
    // Trigger zone is 90 to 92.
    expect(stateMachine.getState(testRobotId)).toBe(RobotState.WAIT_RETRACEMENT);

    // Retracement candle (Price drops into 90 - 92)
    // Wait, Risk Engine needs latest accountBalance. The test RiskEngine config is static 10000. 
    // We update it directly for the test harness since MarketTracker isn't hooked up to refresh risk config dynamically here.
    riskEngine.registerRobotConfig(testRobotId, { symbol: 'BTCUSDT', accountBalance: currentBalance, riskPercent: 1, maxAllocationPercent: 100, leverage: 1 });
    
    await emitCandle(95, 90, 91); // Close at 91 (inside 90-92)
    // This should trigger READY_TO_ENTER -> TRADE_PLAN -> POSITION_OPEN
    
    let { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId).single();
    expect(pos).toBeDefined();
    expect(pos.side).toBe('LONG');
    expect(pos.entry_price).toBe(91);
    expect(pos.take_profit_price).toBe(110); // line3
    expect(pos.stop_loss_price).toBe(90);    // line5
    expect(stateMachine.getState(testRobotId)).toBe(RobotState.POSITION_OPEN);

    // Candle to hit TP
    await emitCandle(115, 95, 112); // High 115 >= TP 110
    
    pos = (await supabase.from('active_positions').select('*').eq('robot_id', testRobotId)).data?.[0];
    expect(pos).toBeUndefined(); // Position closed
    expect(stateMachine.getState(testRobotId)).toBe(RobotState.WAIT_SIGNAL);

    let { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId).order('created_at', { ascending: false }).limit(1).single();
    expect(hist.reason).toBe('TAKE_PROFIT');
    expect(hist.exit_price).toBe(110);
    expect(hist.pnl).toBeGreaterThan(0); // PnL = (110 - 91) * qty

    let { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    currentBalance = robot!.paper_balance;
    console.log(`Balance after Trade 1: ${currentBalance}`);
    expect(currentBalance).toBeGreaterThan(10000);


    // --- TRADE #2: SHORT ENTRY -> SL ---
    
    // Update risk config with new balance
    riskEngine.registerRobotConfig(testRobotId, { symbol: 'BTCUSDT', accountBalance: currentBalance, riskPercent: 1, maxAllocationPercent: 100, leverage: 1 });
    
    // Reset previousClose to between line1 and line2
    await emitCandle(120, 100, 115);
    await emitIndicator(120, 110, 100, 90, 80);
    // Candle close is 115, between line1(120) and line2(110)

    // Trigger signal (Break below line2)
    await emitCandle(115, 100, 105);
    await emitIndicator(120, 110, 100, 90, 80);
    // Candle close is 105, below line2(110). Signal SHORT!
    // Trigger zone is 118 to 120
    expect(stateMachine.getState(testRobotId)).toBe(RobotState.WAIT_RETRACEMENT);

    // Retracement candle (Price rises into 118 - 120)
    await emitCandle(125, 100, 119); // Close at 119 (inside 118-120)
    
    // Position should be open SHORT
    pos = (await supabase.from('active_positions').select('*').eq('robot_id', testRobotId)).data?.[0];
    expect(pos).toBeDefined();
    expect(pos.side).toBe('SHORT');
    expect(pos.entry_price).toBe(119);
    expect(pos.take_profit_price).toBe(100); // line3
    expect(pos.stop_loss_price).toBe(120);   // line1

    // Candle to hit SL
    await emitCandle(125, 110, 122); // High 125 >= SL 120
    
    pos = (await supabase.from('active_positions').select('*').eq('robot_id', testRobotId)).data?.[0];
    expect(pos).toBeUndefined(); // Position closed

    hist = (await supabase.from('trade_history').select('*').eq('robot_id', testRobotId).order('created_at', { ascending: false }).limit(1).single()).data;
    expect(hist.reason).toBe('STOP_LOSS');
    expect(hist.exit_price).toBe(120);
    expect(hist.pnl).toBeLessThan(0); // PnL = (119 - 120) * qty

    robot = (await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single()).data;
    const balanceAfterTrade2 = robot!.paper_balance;
    console.log(`Balance after Trade 2: ${balanceAfterTrade2}`);
    expect(balanceAfterTrade2).toBeLessThan(currentBalance);
    currentBalance = balanceAfterTrade2;


    // --- TRADE #3: DOUBLE HIT (AMBIGUOUS) TEST ---
    
    riskEngine.registerRobotConfig(testRobotId, { symbol: 'BTCUSDT', accountBalance: currentBalance, riskPercent: 1, maxAllocationPercent: 100, leverage: 1 });
    
    // Signal LONG
    await emitCandle(100, 80, 95);
    await emitIndicator(130, 120, 110, 100, 90);
    await emitCandle(115, 95, 105);
    await emitIndicator(130, 120, 110, 100, 90);
    // Retracement
    await emitCandle(95, 90, 91);
    
    pos = (await supabase.from('active_positions').select('*').eq('robot_id', testRobotId)).data?.[0];
    expect(pos).toBeDefined();
    
    // Candle hits BOTH TP(110) and SL(90)
    await emitCandle(115, 85, 100); // High 115 >= TP(110), Low 85 <= SL(90)
    
    // Position should NOT be closed (AMBIGUOUS)
    pos = (await supabase.from('active_positions').select('*').eq('robot_id', testRobotId)).data?.[0];
    expect(pos).toBeDefined(); 
    
    robot = (await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single()).data;
    expect(robot!.paper_balance).toBe(currentBalance); // Balance unchanged

    // Finally close it normally
    await emitCandle(115, 95, 112); // High 115 >= TP(110)
    pos = (await supabase.from('active_positions').select('*').eq('robot_id', testRobotId)).data?.[0];
    expect(pos).toBeUndefined(); // Now it's closed

    // Print Final Balance
    robot = (await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single()).data;
    console.log(`FINAL BALANCE: ${robot!.paper_balance}`);
  }, 20000); // Increase timeout for complex flow

  it('PAPER SAFETY Rejection Test', async () => {
    // Set to LIVE
    await supabase.from('robots').update({ trading_mode: 'LIVE' }).eq('id', testRobotId);
    
    // Emitting a TRADE_PLAN_EVENT manually
    const trace = EventFactory.createTrace('corr', 'parent', 'test', 1);
    const event = EventFactory.createEvent('TRADE_PLAN_EVENT', testRobotId, 1, trace, {
      strategyId: 'test', strategyVersion: '1', symbol: 'BTCUSDT', direction: 'LONG',
      triggerPrice: 100, entryReferencePrice: 100, stopLoss: 90, takeProfit: 110,
      accountBalance: 10000, riskPercent: 1, riskAmount: 100, maxAllocationPercent: 100,
      positionSize: 1, leverage: 1, riskRewardRatio: 1, indicatorReference: { name: 't', config: {}, snapshot: {} }
    });
    
    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 200));

    // Should be rejected
    const { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', testRobotId);
    expect(intents?.length).toBe(0);
  });
});
