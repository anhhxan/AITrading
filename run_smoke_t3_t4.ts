import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '7bc11afd-3841-4ff7-944d-9418ffed0a33';
const robotId = '20261111-0000-4000-a000-111111111111';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log("== T3 CREATE ROBOT ==");
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('trade_history').delete().eq('robot_id', robotId);
    await supabase.from('robot_commands').delete().eq('robot_id', robotId);
    await supabase.from('core_events').delete().eq('robot_id', robotId);
    await supabase.from('robot_configs').delete().eq('robot_id', robotId);
    await supabase.from('robots').delete().eq('id', robotId);

    const { error: t3Err } = await supabase.from('robots').insert({
        id: robotId, user_id: userId, name: 'Paper Smoke Test', slug: 'paper-smoke-test',
        status: 'CREATED', current_state: 'IDLE', trading_mode: 'PAPER',
        trading_session: '24/7', signal_source: 'TRADINGVIEW', provider: 'BINANCE',
        trading_view_symbol: 'BINANCE:BTCUSDT', execution_symbol: 'BTCUSDT', timeframe: '15m', 
        trading_enabled: false, paper_balance: 10000,
        indicator_profile: { type: 'BB_MB', length: 20 }, strategy_profile: { type: 'BB_STRATEGY' },
        risk_profile: { stop_loss_pct: 2, position_allocation_percent: 10, leverage: 1 },
        entry_profile: { type: 'MARKET' }, exit_profile: { type: 'FIXED_EXIT' },
        notification_profile: {}
    });
    if (t3Err) { console.error("T3 FAIL: " + JSON.stringify(t3Err)); return; }

    const { error: t3CfgErr } = await supabase.from('robot_configs').insert({
        robot_id: robotId, version: 1, status: 'ACTIVE',
        indicator_profile: { type: 'BB_MB', length: 20 }, strategy_profile: { type: 'BB_STRATEGY' },
        risk_profile: { stop_loss_pct: 2, position_allocation_percent: 10, leverage: 1 },
        entry_profile: { type: 'MARKET' }, exit_profile: { type: 'FIXED_EXIT' },
        notification_profile: {}, created_by: userId
    });
    if (t3CfgErr) { console.error("T3 Config FAIL: " + JSON.stringify(t3CfgErr)); return; }
    console.log("T3 PASS");

    console.log("== T4 WORKER RECOVERY ==");
    const { error: startErr } = await supabase.from('robots').update({ 
        status: 'RUNNING', trading_enabled: true, current_state: 'WAIT_SIGNAL' 
    }).eq('id', robotId);
    if (startErr) { console.error("T4 Update FAIL: " + JSON.stringify(startErr)); return; }
    
    let t4Pass = false;
    for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const { data: r } = await supabase.from('robots').select('last_heartbeat_at').eq('id', robotId).single();
        if (r && r.last_heartbeat_at) {
            console.log("Worker Heartbeat detected at:", r.last_heartbeat_at);
            t4Pass = true;
            break;
        }
    }
    if (!t4Pass) { console.error("T4 FAIL: No heartbeat detected from Worker."); return; }
    console.log("T4 PASS");
}
run();
