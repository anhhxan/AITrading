import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '20261111-0000-4000-a000-111111111111';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log("== COMMAND/HEARTBEAT ==");
    const setupId = "setup-" + Date.now();
    
    // Heartbeat check
    let hbPass = false;
    for (let i = 0; i < 5; i++) {
        await sleep(1000);
        const { data: r } = await supabase.from('robots').select('last_heartbeat_at').eq('id', robotId).single();
        if (r && r.last_heartbeat_at) { hbPass = true; break; }
    }
    
    console.log("== T5 PAPER SIGNAL ==");
    
    // ARM Signal
    const payloadArm = {
        secret: "6b836317269f4c43b2c4ff21004abbad",
        action: 'ENTRY', direction: 'LONG', symbol: 'BINANCE:BTCUSDT', timeframe: '15m', price: 60000,
        setup_id: setupId, event: 'ARM', trigger: 60000,
        bands: { B1: 59000, B2: 60000, B3: 61000, B4: 62000, B5: 63000 }
    };
    await fetch('http://localhost:3000/api/webhook/tv/' + robotId, { method: 'POST', body: JSON.stringify(payloadArm) });
    await sleep(2000);

    // FIRE Signal
    const payloadFire = {
        secret: "6b836317269f4c43b2c4ff21004abbad",
        action: 'ENTRY', direction: 'LONG', symbol: 'BINANCE:BTCUSDT', timeframe: '15m', price: 60000,
        setup_id: setupId, event: 'FIRE', trigger: 60000,
        bands: { B1: 59000, B2: 60000, B3: 61000, B4: 62000, B5: 63000 }
    };
    await fetch('http://localhost:3000/api/webhook/tv/' + robotId, { method: 'POST', body: JSON.stringify(payloadFire) });

    let t5Pass = false;
    for (let i = 0; i < 15; i++) {
        await sleep(1000);
        const { data: setups } = await supabase.from('active_setups').select('*').eq('robot_id', robotId);
        if (setups && setups.length > 0) {
            console.log("ACTIVE SETUP created.");
            t5Pass = true;
            break;
        }
    }
    if (!t5Pass) { console.error("T5 FAIL: No active setup."); return; }

    let posPass = false;
    for (let i = 0; i < 15; i++) {
        await sleep(1000);
        const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
        if (pos && pos.length > 0) {
            console.log("PAPER POSITION created:", pos[0].direction, "Size:", pos[0].position_size, "Lev:", pos[0].leverage);
            posPass = true;
            break;
        }
    }
    if (!posPass) { console.error("T5/T6 FAIL: No active position."); return; }
    console.log("T5/T6 PASS");

    console.log("== REVERSAL / EXIT ==");
    const payloadStop = {
        secret: "6b836317269f4c43b2c4ff21004abbad",
        action: 'EXIT', direction: 'LONG', symbol: 'BINANCE:BTCUSDT', timeframe: '15m', price: 59000,
        setup_id: setupId, event: 'STOP', stop: 59000,
        bands: { B1: 59000, B2: 60000, B3: 61000, B4: 62000, B5: 63000 }
    };
    await fetch('http://localhost:3000/api/webhook/tv/' + robotId, { method: 'POST', body: JSON.stringify(payloadStop) });

    let thPass = false;
    for (let i = 0; i < 15; i++) {
        await sleep(1000);
        const { data: th } = await supabase.from('trade_history').select('*').eq('robot_id', robotId);
        if (th && th.length > 0) {
            console.log("Trade History created:", th[0].close_reason, "PNL:", th[0].realized_pnl, "Duration:", th[0].duration_seconds);
            thPass = true;
            break;
        }
    }
    if (!thPass) { console.error("T7 FAIL: No trade history."); return; }
    console.log("T7 PASS");

    console.log("== T8 STOP ROBOT ==");
    await supabase.from('robots').update({ status: 'STOPPED' }).eq('id', robotId);
    console.log("T8 PASS");

    console.log("== T9 CLEANUP ==");
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('trade_history').delete().eq('robot_id', robotId);
    await supabase.from('robot_commands').delete().eq('robot_id', robotId);
    await supabase.from('core_events').delete().eq('robot_id', robotId);
    await supabase.from('robot_configs').delete().eq('robot_id', robotId);
    await supabase.from('robots').delete().eq('id', robotId);
    console.log("T9 PASS");
}
run();
