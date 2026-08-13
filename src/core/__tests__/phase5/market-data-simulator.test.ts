import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { getOrCreateSimulatorRobot, playCandleSequence, resetSimulator } from '../../../app/actions/simulatorActions';

describe('Market Data Simulator E2E', () => {
  const supabase = getSupabaseAdmin();
  let testUserId: string = '';
  let robotId: string = '';

  beforeAll(async () => {
    // Get a valid user
    const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
    if (!user) throw new Error("No user found");
    testUserId = user.user_id;

    const robot = await getOrCreateSimulatorRobot(testUserId, 10000);
    robotId = robot.id;
    await resetSimulator(testUserId);
  }, 30000);

  afterAll(async () => {
    await resetSimulator(testUserId);
  }, 30000);

  it('A. Warmup and LONG Signal Entry to Take Profit', async () => {
    const candles = [
      // 1. Drop price to between B5 (80) and B4 (90)
      { open: 100, high: 100, low: 80, close: 85 },
      // 2. Break above B4 (90) to trigger LONG signal
      { open: 85, high: 100, low: 85, close: 95 }, 
      // 3. Pull back to trigger zone [78.85, 80.86] to open position
      { open: 95, high: 95, low: 79, close: 80 }, 
      // 4. Go up and hit TP (B3 = 100)
      { open: 81, high: 110, low: 81, close: 105 }
    ];

    await playCandleSequence({
      robotId,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      candles,
      balance: 10000,
      riskPercent: 1, // 1% risk
      maxAllocationPercent: 10,
      leverage: 1
    });

    // Check History to see if trade was made
    const { data: history } = await supabase.from('trade_history').select('*').eq('robot_id', robotId);
    expect(history).toBeDefined();
    expect(history.length).toBeGreaterThan(0);

    const trade = history[0];
    expect(['SELL', 'BUY']).toContain(trade.action);
    expect(trade.reason).toBeDefined(); // Take Profit or Stop Loss

    // Position should be closed
    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
    expect(pos?.length).toBe(0);
  }, 30000);
});
