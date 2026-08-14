import { getSupabaseAdmin } from '../lib/supabase';
import crypto from 'crypto';

const API_URL = 'http://localhost:3000/api/webhook/tv';
const SECRET = process.env.TV_WEBHOOK_SECRET || 'secret';

const supabase = getSupabaseAdmin();

async function sendWebhook(robotId: string, payload: any) {
  const res = await fetch(`${API_URL}/${robotId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch(e) { json = text; }
  return { status: res.status, json };
}

async function run() {
  console.log("=== Phase 6 E2E Webhook Validation ===");
  
  // Create a fresh user & robot
  const userId = crypto.randomUUID();
  await supabase.from('robots').insert({
    id: userId,
    user_id: '4f8dbd80-b2cb-464a-bb12-6a5a0cc6c2c3', // Assume a user exists, or create one. Wait, we can just use the existing test user logic
  });
  // Since we don't know the exact user, let's query the first available user.
  const { data: user } = await supabase.from('robots').select('user_id').limit(1).single();
  const testUserId = user?.user_id || '00000000-0000-0000-0000-000000000000';
  
  const robotId1 = crypto.randomUUID();
  const { error: robotErr } = await supabase.from('robots').insert({
    id: robotId1,
    user_id: testUserId,
    name: 'E2E-Robot-1',
    slug: robotId1,
    status: 'RUNNING',
    trading_enabled: true,
    trading_mode: 'PAPER',
    signal_source: 'TRADINGVIEW',
    provider: 'BINANCE',
    trading_session: '24/7',
    execution_symbol: 'BTCUSDT',
    trading_view_symbol: 'BINANCE:BTCUSDT',
    timeframe: '15m',
    paper_balance: 10000
  });
  if (robotErr) throw new Error("Robot Insert Error: " + robotErr.message);

  const { error: confErr } = await supabase.from('robot_configs').insert({
    robot_id: robotId1,
    version: 1,
    status: 'ACTIVE',
    indicator_profile: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
    strategy_profile: { type: 'BB_Strategy' },
    risk_profile: { max_allocation_percent: 100 },
    entry_profile: { type: 'MARKET' },
    exit_profile: { type: 'TAKE_PROFIT' }
  });
  if (confErr) throw new Error("Config Insert Error: " + confErr.message);

  // Base Payload Template
  const basePayload = {
    tvSymbol: 'BINANCE:BTCUSDT',
    tvTickerId: 'BTCUSDT',
    timeframe: '15',
    barTimestamp: Date.now(),
    open: 100, high: 100, low: 100, close: 100, volume: 100,
    indicator: { length: 20, source: 'close', mult: 2.0, mult2: 1.0 },
    plots: { upper: 105, upper2: 110, basis: 100, lower2: 90, lower: 95 }
  };

  try {
    console.log("\n--- Case A: Missing BB Config (in payload) ---");
    const payloadA = { ...basePayload, indicator: { source: 'close', mult: 2.0, mult2: 1.0 } };
    const resA = await sendWebhook(robotId1, payloadA);
    console.log("Response:", resA.status, resA.json);
    if (resA.status !== 400 || !resA.json.details?.includes("Length mismatch")) throw new Error("Failed Case A");

    console.log("\n--- Case B: Invalid BB Config (Length mismatch) ---");
    const payloadB = { ...basePayload, indicator: { length: 14, source: 'close', mult: 2.0, mult2: 1.0 } };
    const resB = await sendWebhook(robotId1, payloadB);
    console.log("Response:", resB.status, resB.json);
    if (resB.status !== 400 || !resB.json.details?.includes("Length mismatch")) throw new Error("Failed Case B");

    console.log("\n--- Case C: Invalid Robot ID ---");
    const resC = await sendWebhook(crypto.randomUUID(), basePayload);
    console.log("Response:", resC.status, resC.json);
    if (resC.status !== 404) throw new Error("Failed Case C");

    console.log("\n--- Case D: Malformed Webhook Payload ---");
    const resD = await fetch(`${API_URL}/${robotId1}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
      body: '{"invalid": json'
    });
    console.log("Response:", resD.status);
    if (resD.status !== 400) throw new Error("Failed Case D");

    console.log("\n--- Happy Path: Trade OPEN ---");
    // Warmup candle to set previousClose
    const payload0 = {
      ...basePayload,
      barTimestamp: Date.now() - 1000 * 60 * 30,
      close: 108, // Between b1(110) and b2(105) assuming upper=110, upper2=105
      plots: { upper: 110, upper2: 105, basis: 100, lower2: 95, lower: 90 }
    };
    await sendWebhook(robotId1, payload0);
    await new Promise(r => setTimeout(r, 1000));

    // Send a candle that closes below b2 to trigger a SHORT signal
    const payload1 = {
      ...basePayload,
      barTimestamp: Date.now() - 1000 * 60 * 15,
      close: 104, // < b2 (105) -> triggers SHORT!
      plots: { upper: 110, upper2: 105, basis: 100, lower2: 95, lower: 90 }
    };
    const resOp = await sendWebhook(robotId1, payload1);
    console.log("Webhook 1 (Signal) Response:", resOp.status, resOp.json);

    // Give it a second to process (since webhook wait for idle but let's be safe)
    await new Promise(r => setTimeout(r, 1000));
    
    // Now send the entry candle (retrace)
    const payload2 = {
      ...basePayload,
      barTimestamp: Date.now(),
      close: 109.5, 
      plots: { upper: 110, upper2: 105, basis: 100, lower2: 95, lower: 90 }
    };
    const resEntry = await sendWebhook(robotId1, payload2);
    console.log("Webhook 2 (Entry) Response:", resEntry.status, resEntry.json);

    console.log("\n--- Case E: Duplicate Webhook Idempotency Check ---");
    const resDuplicate = await sendWebhook(robotId1, payload2);
    console.log("Response:", resDuplicate.status, resDuplicate.json);
    if (resDuplicate.status !== 200 || resDuplicate.json.message !== 'Duplicate acknowledged') {
       throw new Error("Failed Idempotency Check");
    }

    console.log("\n--- Multi-Robot Isolation & Context Snapshot ---");
    console.log("Checking DB state for OPEN position...");
    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId1).single();
    if (!pos) throw new Error("Position was not opened! Logic failed.");
    console.log("Position Opened successfully:", pos.side, pos.quantity);

    // Change robot config to something else
    await supabase.from('robot_configs').update({ status: 'INACTIVE' }).eq('robot_id', robotId1);
    await supabase.from('robot_configs').insert({
      robot_id: robotId1,
      version: 2,
      status: 'ACTIVE',
      indicator_profile: { length: 50, source: 'close', mult: 3.0, mult2: 2.0 },
      strategy_profile: { type: 'BB_Strategy' },
      risk_profile: { max_allocation_percent: 100 },
      entry_profile: { type: 'MARKET' },
      exit_profile: { type: 'TAKE_PROFIT' }
    });
    
    // Send close candle
    const payload3 = {
      ...basePayload,
      barTimestamp: Date.now() + 1000 * 60 * 15,
      open: 109,
      close: 95, 
      high: 109, 
      low: 95, // Hits TP (100) but not SL (110)
      indicator: { length: 50, source: 'close', mult: 3.0, mult2: 2.0 }, // using NEW config
      plots: { upper: 105, upper2: 110, basis: 100, lower2: 90, lower: 95 }
    };
    const resClose = await sendWebhook(robotId1, payload3);
    console.log("Webhook 3 (Close) Response:", resClose.status, resClose.json);
    
    // Check trade history
    const { data: trade } = await supabase.from('trade_history').select('*').eq('robot_id', robotId1).single();
    if (!trade) throw new Error("Trade was not closed! Context might have been lost.");
    
    console.log("Trade history verified. Execution Symbol:", trade.execution_symbol);
    console.log("Indicator Snapshot Length:", (trade.indicator_snapshot as any).config.length);
    if ((trade.indicator_snapshot as any).config.length !== 20) {
      throw new Error("Historical Integrity Failed! Snapshot used new config instead of old config.");
    }
    
    // Check balance
    const { data: robotAfter } = await supabase.from('robots').select('paper_balance').eq('id', robotId1).single();
    console.log("Final Balance:", robotAfter?.paper_balance);
    if (robotAfter?.paper_balance === 10000) {
       throw new Error("P&L was not applied to paper_balance.");
    }

    console.log("\nALL TESTS PASSED ✅");

  } finally {
    // Cleanup
    await supabase.from('robot_commands').delete().eq('robot_id', robotId1);
    await supabase.from('trade_history').delete().eq('robot_id', robotId1);
    await supabase.from('active_positions').delete().eq('robot_id', robotId1);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId1);
    await supabase.from('robot_configs').delete().eq('robot_id', robotId1);
    await supabase.from('robots').delete().eq('id', robotId1);
  }
}

run();
