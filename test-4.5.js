const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193';
const proxyToken = process.env.CLOUDFLARE_PROXY_TOKEN;
const webhookUrl = `https://tv-webhook-proxy.tradingbn.workers.dev/tv/${robotId}/${proxyToken}`;

const delay = ms => new Promise(res => setTimeout(res, ms));

async function sendWebhook(payload) {
  console.log(`Sending Webhook: action=${payload.action}, time=${payload.barTimestamp}`);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log(`Status: ${res.status}`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Response:', text);
  }
}

async function run() {
  console.log('=== TEST 2: REAL SIGNAL SEQUENCE (LONG) ===');
  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1780000000000,
    open: 92000, high: 93000, low: 90000, close: 91000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  });
  await delay(3000);

  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1780000900000,
    open: 91000, high: 94000, low: 91000, close: 93000, volume: 15,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  });
  await delay(3000);

  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1780001800000,
    open: 91000, high: 92000, low: 90200, close: 91500, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  });

  console.log('Waiting 5s for pipeline execution...');
  await delay(5000);

  console.log('=== VERIFY LONG RESULTS ===');
  const { data: pos1 } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log('Active Positions:', pos1);

  const { data: ints1 } = await supabase.from('execution_intents').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(2);
  console.log('Recent Intents:', ints1);

  console.log('=== TEST 4: REVERSAL (SHORT) ===');
  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1780002700000,
    open: 95000, high: 96000, low: 94000, close: 99000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  });
  await delay(3000);

  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1780003600000,
    open: 99000, high: 101000, low: 99000, close: 97000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  });
  await delay(3000);

  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1780004500000,
    open: 97000, high: 99800, low: 97000, close: 98500, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 98000, basis: 95000, lower2: 92000, lower: 90000 }
  });

  console.log('Waiting 5s for pipeline execution...');
  await delay(5000);

  console.log('=== VERIFY REVERSAL RESULTS ===');
  const { data: pos2 } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log('Active Positions after reversal:', pos2);

  const { data: ints2 } = await supabase.from('execution_intents').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(2);
  console.log('Recent Intents after reversal:', ints2);

  const { data: hist } = await supabase.from('position_history').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1);
  console.log('Position History (Closed PnL):', hist);
}

run();
