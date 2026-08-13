import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { getOrCreateSimulatorRobot, openSimulatorTrade, sendSimulatedCandle, resetSimulator } from '../../../app/actions/simulatorActions';

describe('Quick Paper Simulator E2E', () => {
  const supabase = getSupabaseAdmin();
  let testUserId: string = '';
  let robotId: string = '';

  beforeAll(async () => {
    // Get a valid user
    const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
    if (!user) throw new Error("No user found");
    testUserId = user.user_id;

    // A. Create Simulator Robot
    const robot = await getOrCreateSimulatorRobot(testUserId, 10000);
    robotId = robot.id;
  });

  afterAll(async () => {
    // T. Cleanup
    await resetSimulator(testUserId);
  });

  it('A. Simulator Robot has correct properties', async () => {
    const { data: robot } = await supabase.from('robots').select('*').eq('id', robotId).single();
    expect(robot.trading_mode).toBe('PAPER');
    expect(robot.paper_balance).toBe(10000);
    expect(robot.slug).toBe(`quick-paper-simulator-${testUserId}`);
  });

  it('B. LONG open with % Balance', async () => {
    await openSimulatorTrade({
      userId: testUserId,
      robotId,
      symbol: 'BTCUSDT',
      tradingViewSymbol: 'BINANCE:BTCUSDT',
      direction: 'LONG',
      entryPrice: 100000,
      stopLoss: 99000,
      takeProfit: 102000,
      balance: 10000,
      sizingMode: 'ALLOCATION',
      allocationPercent: 10, // $1000
      riskPercent: 1
    });

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).single();
    expect(pos).toBeDefined();
    expect(pos.side).toBe('LONG');
    expect(pos.entry_price).toBe(100000);
    expect(pos.quantity).toBe(1000 / 100000); // 0.01

    // Clean up for next test
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
  });

  it('C. SHORT open with Risk %', async () => {
    await openSimulatorTrade({
      userId: testUserId,
      robotId,
      symbol: 'ETHUSDT',
      tradingViewSymbol: 'BINANCE:ETHUSDT',
      direction: 'SHORT',
      entryPrice: 2000,
      stopLoss: 2100, // Distance 100
      takeProfit: 1800,
      balance: 10000,
      sizingMode: 'RISK',
      allocationPercent: 100,
      riskPercent: 1 // $100 risk
    });

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).single();
    expect(pos).toBeDefined();
    expect(pos.side).toBe('SHORT');
    expect(pos.entry_price).toBe(2000);
    expect(pos.quantity).toBe(100 / 100); // 1.0

    // J. SHORT TP
    // Send candle hitting TP
    await sendSimulatedCandle({
      robotId,
      symbol: 'ETHUSDT',
      timeframe: '15m',
      open: 1900,
      high: 1950,
      low: 1750, // Hits 1800
      close: 1780
    });

    // Check closed
    const { data: posAfter } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).single();
    expect(posAfter).toBeNull();

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1).single();
    expect(hist.reason).toBe('TAKE_PROFIT');
    expect(hist.pnl).toBe((2000 - 1800) * 1); // 200

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', robotId).single();
    expect(robot.paper_balance).toBe(10000 + 200);
  });

  it('K. Double Hit (AMBIGUOUS)', async () => {
    // Open LONG
    await openSimulatorTrade({
      userId: testUserId,
      robotId,
      symbol: 'BTCUSDT',
      tradingViewSymbol: 'BINANCE:BTCUSDT',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 90,
      takeProfit: 110,
      balance: 10200,
      sizingMode: 'FIXED',
      fixedQuantity: 1,
      allocationPercent: 100,
      riskPercent: 1
    });

    // Send Ambiguous Candle
    await sendSimulatedCandle({
      robotId,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      open: 100,
      high: 115, // >= 110
      low: 85, // <= 90
      close: 100
    });

    // Position remains OPEN
    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).single();
    expect(pos).toBeDefined();

    // Clean up
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
  });

  it('Q. LIVE Rejection Safety', async () => {
    // Change to LIVE temporarily
    await supabase.from('robots').update({ trading_mode: 'LIVE' }).eq('id', robotId);

    // Try to open trade
    await openSimulatorTrade({
      userId: testUserId,
      robotId,
      symbol: 'BTCUSDT',
      tradingViewSymbol: 'BINANCE:BTCUSDT',
      direction: 'LONG',
      entryPrice: 100000,
      stopLoss: 99000,
      takeProfit: 102000,
      balance: 10000,
      sizingMode: 'FIXED',
      fixedQuantity: 1,
      allocationPercent: 10,
      riskPercent: 1
    });

    // Expect NOT created
    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
    expect(pos?.length).toBe(0);

    // Revert to PAPER
    await supabase.from('robots').update({ trading_mode: 'PAPER' }).eq('id', robotId);
  });
});
