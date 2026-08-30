
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/A/Tradding AI/trading-platform/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193';
const API_URL = 'http://localhost:3000/api/webhook/tv/' + robotId;
const SECRET = '6b836317269f4c43b2c4ff21004abbad';

async function sendWebhook(setup_id, event, direction, ts, trigger = 98, stop = 92) {
    const payload = {
        secret: SECRET,
        setup_id,
        event,
        direction,
        symbol: 'BINANCE:BTCUSDT',
        timeframe: '1m',
        barTimestamp: ts,
        eventTimestamp: ts,
        bands: { B1: 110, B2: 105, B3: 100, B4: 95, B5: 90 },
        trigger,
        stop
    };
    await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    // wait for processing
    await new Promise(r => setTimeout(r, 2000));
}

async function run() {
    console.log('--- CLEANUP ---');
    await supabase.from('robot_commands').delete().eq('robot_id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
    await supabase.from('active_orders').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('trade_history').delete().eq('robot_id', robotId);

    const setup1 = 'tv_' + Date.now();

    console.log('\n--- TEST 2: ARM ---');
    await sendWebhook(setup1, 'ARM', 'LONG', Date.now());
    let { count: cSetupARM } = await supabase.from('active_setups').select('*', { count: 'exact', head: true }).eq('setup_id', setup1);
    console.log('active_setups count after ARM:', cSetupARM);

    console.log('\n--- TEST 3: FIRE ---');
    await sendWebhook(setup1, 'FIRE', 'LONG', Date.now() + 1000);
    let { data: setupFire } = await supabase.from('active_setups').select('*').eq('setup_id', setup1).single();
    let { count: cPosFire } = await supabase.from('active_positions').select('*', { count: 'exact', head: true }).eq('setup_id', setup1);
    console.log('Setup state:', setupFire?.state);
    console.log('active_positions count after FIRE:', cPosFire);

    console.log('\n--- TEST 4: STOP ---');
    await sendWebhook(setup1, 'STOP', 'LONG', Date.now() + 2000, 98, 91);
    let { count: cPosStop } = await supabase.from('active_positions').select('*', { count: 'exact', head: true }).eq('setup_id', setup1);
    let { count: cHistStop } = await supabase.from('trade_history').select('*', { count: 'exact', head: true }).eq('robot_id', robotId);
    console.log('active_positions count after STOP:', cPosStop);
    console.log('trade_history count after STOP:', cHistStop);

    console.log('\n--- TEST 5: Duplicate ARM ---');
    const setup2 = 'tv_' + Date.now();
    await sendWebhook(setup2, 'ARM', 'SHORT', Date.now() + 3000);
    await sendWebhook(setup2, 'ARM', 'SHORT', Date.now() + 3000); // exact duplicate timestamp
    let { count: cSetup2 } = await supabase.from('active_setups').select('*', { count: 'exact', head: true }).eq('setup_id', setup2);
    console.log('active_setups count after duplicate ARM:', cSetup2);

    console.log('\n--- TEST 6: Duplicate FIRE ---');
    await sendWebhook(setup2, 'FIRE', 'SHORT', Date.now() + 4000);
    await sendWebhook(setup2, 'FIRE', 'SHORT', Date.now() + 4000);
    let { count: cPosDupFire } = await supabase.from('active_positions').select('*', { count: 'exact', head: true }).eq('setup_id', setup2);
    console.log('active_positions count after duplicate FIRE:', cPosDupFire);

    console.log('\n--- TEST 7: FIRE without ARM ---');
    const setup3 = 'tv_' + Date.now();
    await sendWebhook(setup3, 'FIRE', 'LONG', Date.now() + 5000);
    let { count: cSetup3 } = await supabase.from('active_setups').select('*', { count: 'exact', head: true }).eq('setup_id', setup3);
    let { count: cPosNoArm } = await supabase.from('active_positions').select('*', { count: 'exact', head: true }).eq('setup_id', setup3);
    console.log('active_setups count:', cSetup3);
    console.log('active_positions count:', cPosNoArm);

    console.log('\n--- DONE ---');
}
run();
