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
}

async function run() {
  console.log('=== TEST: REVERSAL PREP (LONG) ===');
  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1810000000000,
    open: 92000, high: 93000, low: 90000, close: 91000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 130000, upper2: 132000, basis: 120000, lower2: 92000, lower: 90000 }
  });
  await delay(3000);

  // Return inside band (trigger) and retrace low (entry) all in one candle!
  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1810000900000,
    open: 91000, high: 94000, low: 91000, close: 93000, volume: 15,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 130000, upper2: 132000, basis: 120000, lower2: 92000, lower: 90000 }
  });

  console.log('Waiting 5s for pipeline execution...');
  await delay(5000);

  console.log('=== TEST: REVERSAL TRIGGER (SHORT) ===');
  // Breakout UP
  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1810002700000,
    open: 105000, high: 110000, low: 104000, close: 109000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 105000, basis: 80000, lower2: 70000, lower: 75000 }
  });
  await delay(3000);

  // Return INSIDE + Retrace HIGH
  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1810003600000,
    open: 109000, high: 112000, low: 100000, close: 104000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 105000, basis: 80000, lower2: 70000, lower: 75000 }
  });

  console.log('Waiting 5s for pipeline execution...');
  await delay(5000);

  console.log('=== VERIFY REVERSAL RESULTS ===');
  const { data: pos2 } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log('Active Positions after reversal:', pos2);

  const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', robotId).eq('reason', 'REVERSAL');
  console.log('Trade History (Closed PnL):', hist);
}

run();
