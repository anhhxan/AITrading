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
  // Long Prepare: prevClose between line5(90000) and line4(92000). close = 91000.
  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1830000000000,
    open: 92000, high: 93000, low: 90000, close: 91000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 130000, upper2: 132000, basis: 120000, lower: 92000, lower2: 90000 }
  });
  await delay(3000);

  // Long Trigger: currClose > line4. close = 93000 > 92000.
  // entryTrigger lower = line5 = 90000. upper = line5 + 2000*0.25 = 90500.
  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1830000900000,
    open: 91000, high: 94000, low: 91000, close: 93000, volume: 15,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 130000, upper2: 132000, basis: 120000, lower: 92000, lower2: 90000 }
  });
  await delay(3000);

  // Long Entry: low <= 90500. low = 90200.
  await sendWebhook({
    action: "BUY", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1830001800000,
    open: 91000, high: 92000, low: 90200, close: 91500, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 130000, upper2: 132000, basis: 120000, lower: 92000, lower2: 90000 }
  });

  console.log('Waiting 5s for pipeline execution...');
  await delay(5000);

  const { data: pos1 } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log('Active Positions (Should be 1 LONG):', pos1.length);

  console.log('=== TEST: REVERSAL TRIGGER (SHORT) ===');
  // Short Prepare: close between upper(100000) and upper2(105000). close = 102000.
  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1830002700000,
    open: 101000, high: 103000, low: 100000, close: 102000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 105000, basis: 80000, lower: 75000, lower2: 70000 }
  });
  await delay(3000);

  // Short Trigger: currClose < upper. close = 99000 < 100000.
  // entryTrigger lower = upper2 - (upper2 - upper)*0.25 = 105000 - 1250 = 103750.
  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1830003600000,
    open: 102000, high: 103000, low: 98000, close: 99000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 105000, basis: 80000, lower: 75000, lower2: 70000 }
  });
  await delay(3000);

  // Short Entry: high >= 103750. high = 104000.
  await sendWebhook({
    action: "SELL", tvSymbol: "BINANCE:BTCUSDT", timeframe: "15m", barTimestamp: 1830004500000,
    open: 99000, high: 104000, low: 98000, close: 102000, volume: 10,
    indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
    plots: { upper: 100000, upper2: 105000, basis: 80000, lower: 75000, lower2: 70000 }
  });

  console.log('Waiting 5s for pipeline execution...');
  await delay(5000);

  console.log('=== VERIFY REVERSAL RESULTS ===');
  const { data: pos2 } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
  console.log('Active Positions after reversal:', pos2);

  const { data: hist } = await supabase.from('trade_history').select('*').eq('robot_id', robotId).eq('reason', 'REVERSAL').order('created_at', { ascending: false }).limit(2);
  console.log('Trade History (Closed PnL):', hist);
}

run();
