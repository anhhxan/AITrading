const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { PaperExecutionEngine } = require('./src/core/engine/execution/PaperExecutionEngine');
const { coreEventBus } = require('./src/core/infrastructure/EventBus');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  console.log('=== TEST: DIRECT PAPER REVERSAL ===');

  // 1. Manually ensure a LONG position exists in active_positions for this robot
  const { data: existingPos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).maybeSingle();
  if (existingPos) {
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
  }

  console.log('Creating a mock LONG active position...');
  await supabase.from('active_positions').insert({
    robot_id: robotId,
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: 0.1,
    entry_price: 90000,
    leverage: 1,
    unrealized_pnl: 0,
    realized_pnl: 0,
    stop_loss_price: 89000,
    take_profit_price: 95000,
    context_snapshot: {
      executionSymbol: 'BTCUSDT',
      tradingViewSymbol: 'BINANCE:BTCUSDT',
      timeframe: '15m',
      strategyId: 'BB_Strategy'
    }
  });

  const engine = new PaperExecutionEngine();
  await engine.initialize();

  // 2. Emit a SHORT TRADE_PLAN_EVENT directly to coreEventBus to simulate a reversal
  const mockTrace = {
    correlationId: 'test-reversal-' + Date.now(),
    sequence: 1,
    path: []
  };

  const tradePlanEvent = {
    eventType: 'TRADE_PLAN_EVENT',
    eventId: uuidv4(),
    robotId: robotId,
    timestamp: Date.now(),
    trace: mockTrace,
    configVersion: 1,
    direction: 'SHORT', // The Reversal!
    entryReferencePrice: 85000, // Price dropped!
    stopLoss: 90000,
    takeProfit: 80000,
    positionSize: 0.1,
    leverage: 1,
    executionSymbol: 'BTCUSDT',
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    timeframe: '15m',
    strategyId: 'BB_Strategy',
    orderType: 'MARKET'
  };

  console.log('Publishing SHORT TRADE_PLAN_EVENT directly to trigger reversal logic...');
  await coreEventBus.publish(tradePlanEvent);

  console.log('Waiting 5s for Execution Engine to process...');
  await delay(5000);

  console.log('=== VERIFY REVERSAL RESULTS ===');
  const { data: posAfter } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log('Active Positions after reversal (Should be 1 SHORT):', posAfter);

  const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', robotId).eq('reason', 'REVERSAL').order('created_at', { ascending: false }).limit(2);
  console.log('Trade History (Closed PnL for LONG):', hist);

  process.exit(0);
}

run();
