import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { PaperPositionTracker } from '../../engine/execution/PaperPositionTracker';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';

describe('PaperPositionTracker (Phase 1C)', () => {
  const supabase = getSupabaseAdmin();
  let testRobotId = '';
  let tracker = new PaperPositionTracker();

  beforeAll(async () => {
    await tracker.initialize();
  });

  afterAll(async () => {
    await tracker.shutdown();
  });

  beforeEach(async () => {
    const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
    if (!user) throw new Error("No user found");

    const { data: robot } = await supabase.from('robots').insert({
      name: 'Paper Tracker Test',
      slug: `tracker-test-${Date.now()}`,
      user_id: user.user_id,
      trading_mode: 'PAPER',
      trading_enabled: false,
      status: 'CREATED',
      current_state: 'POSITION_OPEN',
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
    await supabase.from('trade_history').delete().eq('robot_id', testRobotId);
    await supabase.from('active_positions').delete().eq('robot_id', testRobotId);
    await supabase.from('robots').delete().eq('id', testRobotId);
  });

  async function createPosition(side: 'LONG' | 'SHORT', entry: number, tp: number, sl: number, quantity: number = 100) {
    await supabase.from('active_positions').insert({
      robot_id: testRobotId,
      symbol: 'BTCUSDT',
      side: side,
      quantity: quantity,
      entry_price: entry,
      leverage: 1,
      unrealized_pnl: 0,
      realized_pnl: 0,
      stop_loss_price: sl,
      take_profit_price: tp,
      binance_position_id: null
    });
  }

  async function emitCandle(high: number, low: number, close: number = 3400) {
    const trace = EventFactory.createTrace('corr', 'parent', 'test', 1);
    const event = EventFactory.createEvent('CANDLE_CLOSED', testRobotId, 1, trace, {
      candle: { open: 3400, high, low, close, timestamp: Date.now(), volume: 100 }
    });
    await coreEventBus.publish(event as any);
    await new Promise(r => setTimeout(r, 1000));
  }

  it('A & E. LONG TP & P&L', async () => {
    await createPosition('LONG', 3400, 3440, 3380, 100);
    // Candle hits TP (3440) but not SL (3380)
    await emitCandle(3450, 3395);

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(pos?.length).toBe(0);

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId).single();
    expect(hist!.reason).toBe('TAKE_PROFIT');
    expect(hist!.exit_price).toBe(3440);
    expect(hist!.pnl).toBe(4000); // (3440 - 3400) * 100 = 4000

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot!.paper_balance).toBe(14000); // G. Paper Balance updated
  });

  it('B. LONG SL', async () => {
    await createPosition('LONG', 3400, 3440, 3380, 100);
    // Candle hits SL (3380) but not TP (3440)
    await emitCandle(3410, 3375);

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(pos?.length).toBe(0);

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId).single();
    expect(hist!.reason).toBe('STOP_LOSS');
    expect(hist!.exit_price).toBe(3380);
    expect(hist!.pnl).toBe(-2000); // (3380 - 3400) * 100 = -2000

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot!.paper_balance).toBe(8000);
  });

  it('C & F. SHORT TP & P&L', async () => {
    await createPosition('SHORT', 3400, 3360, 3420, 10);
    // Candle hits TP (3360) but not SL (3420)
    await emitCandle(3405, 3350);

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(pos?.length).toBe(0);

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId).single();
    expect(hist!.reason).toBe('TAKE_PROFIT');
    expect(hist!.exit_price).toBe(3360);
    expect(hist!.pnl).toBe(400); // (3400 - 3360) * 10 = 400

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot!.paper_balance).toBe(10400);
  });

  it('D. SHORT SL', async () => {
    await createPosition('SHORT', 3400, 3360, 3420, 10);
    // Candle hits SL (3420) but not TP (3360)
    await emitCandle(3430, 3390);

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(pos?.length).toBe(0);

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId).single();
    expect(hist!.reason).toBe('STOP_LOSS');
    expect(hist!.exit_price).toBe(3420);
    expect(hist!.pnl).toBe(-200); // (3400 - 3420) * 10 = -200

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot!.paper_balance).toBe(9800);
  });

  it('H. Duplicate Candle Event (Idempotency)', async () => {
    await createPosition('LONG', 3400, 3440, 3380, 100);
    
    // First candle hits TP
    await emitCandle(3450, 3395);
    // Second candle identical
    await emitCandle(3450, 3395);

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId);
    expect(hist?.length).toBe(1); // Only 1 history record
    
    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot!.paper_balance).toBe(14000); // Balance not updated twice
  });

  it('I. Double-hit -> AMBIGUOUS', async () => {
    await createPosition('LONG', 3400, 3440, 3380, 100);
    // Candle hits BOTH TP (3440) and SL (3380)
    await emitCandle(3450, 3350);

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(pos?.length).toBe(1); // Position NOT closed!

    const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', testRobotId);
    expect(hist?.length).toBe(0); // No history

    const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', testRobotId).single();
    expect(robot!.paper_balance).toBe(10000); // Balance unchanged
  });

  it('J. LIVE rejection', async () => {
    await supabase.from('robots').update({ trading_mode: 'LIVE' }).eq('id', testRobotId);
    await createPosition('LONG', 3400, 3440, 3380, 100);
    
    // Candle hits TP
    await emitCandle(3450, 3395);

    // Should be rejected because mode is LIVE
    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', testRobotId);
    expect(pos?.length).toBe(1); // Not closed
  });
});
