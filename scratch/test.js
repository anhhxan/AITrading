const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';

async function runTest() {
  console.log('Starting Test Sequence...');

  // A. ENTRY LONG
  const entryId = 'tv_entry_' + Date.now();
  console.log('\nA. Inserting ENTRY_LONG Webhook (' + entryId + ')...');
  await insertCommand(entryId, {
    action: 'ENTRY_LONG',
    robot_slug: 'paper-10m',
    strategy: 'BB_MB',
    symbol: 'BINANCE:BTCUSDT',
    timeframe: '15',
    side: 'LONG',
    entry_price: 60000,
    stop_loss: 59000,
    take_profit: 61000,
    signal_timestamp: Date.now(),
    config_version: 1,
    indicator_snapshot: { line1: 62000, line2: 61000, line3: 60000, line4: 59000, line5: 58000 }
  });
  await wait(45000); // 45s wait for Railway Poller

  await checkPosition('Expected: 1 LONG Position');

  // B. Duplicate ENTRY LONG
  console.log('\nB. Inserting Duplicate ENTRY_LONG...');
  await insertCommand(entryId + '_dup', {
    action: 'ENTRY_LONG', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'LONG', entry_price: 60000
  });
  await wait(45000);
  await checkPosition('Expected: Still exactly 1 LONG Position');

  // C. ENTRY SHORT while LONG OPEN
  console.log('\nC. Inserting ENTRY_SHORT while LONG is open...');
  await insertCommand('tv_entry_short_' + Date.now(), {
    action: 'ENTRY_SHORT', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'SHORT', entry_price: 60000
  });
  await wait(45000);
  await checkPosition('Expected: Still exactly 1 LONG Position (IGNORED)');

  // H. Side Mismatch
  console.log('\nH. Inserting EXIT_SHORT while LONG is open...');
  await insertCommand('tv_exit_short_mismatch_' + Date.now(), {
    action: 'EXIT_SHORT', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'SHORT', entry_price: 60500
  });
  await wait(45000);
  await checkPosition('Expected: Still exactly 1 LONG Position (MISMATCH IGNORED)');

  // D. EXIT LONG
  console.log('\nD. Inserting EXIT_LONG...');
  await insertCommand('tv_exit_long_' + Date.now(), {
    action: 'EXIT_LONG', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'LONG', entry_price: 60500
  });
  await wait(45000);
  await checkPosition('Expected: 0 Positions (LONG CLOSED)');

  // E. ENTRY SHORT after CLOSE
  console.log('\nE. Inserting ENTRY_SHORT after close...');
  await insertCommand('tv_new_short_' + Date.now(), {
    action: 'ENTRY_SHORT', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'SHORT', entry_price: 60000
  });
  await wait(45000);
  await checkPosition('Expected: 1 SHORT Position');

  // F. EXIT SHORT
  console.log('\nF. Inserting EXIT_SHORT...');
  await insertCommand('tv_exit_short_' + Date.now(), {
    action: 'EXIT_SHORT', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'SHORT', entry_price: 59500
  });
  await wait(45000);
  await checkPosition('Expected: 0 Positions (SHORT CLOSED)');

  // G. EXIT WHEN NO POSITION
  console.log('\nG. Inserting EXIT_LONG when no position...');
  await insertCommand('tv_empty_exit_' + Date.now(), {
    action: 'EXIT_LONG', robot_slug: 'paper-10m', symbol: 'BINANCE:BTCUSDT', side: 'LONG', entry_price: 60000
  });
  await wait(45000);
  await checkPosition('Expected: 0 Positions (IGNORED NO CRASH)');
}

async function insertCommand(correlationId, resultPayload) {
  const { error } = await supabase.from('robot_commands').insert({
    robot_id: robotId,
    command_type: 'process_webhook',
    correlation_id: correlationId,
    status: 'RECEIVED',
    result: resultPayload
  });
  if (error) console.error('Insert error:', error);
}

async function checkPosition(label) {
  const { data } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log(label);
  console.log('Actual position count: ' + data.length);
  if (data.length > 0) {
    console.log('- Side: ' + data[0].side + ', Entry: ' + data[0].entry_price + ', Qty: ' + data[0].quantity);
  }
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

runTest().then(() => console.log('\nDone.'));
