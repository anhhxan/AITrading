require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193'; 

async function runE2E() {
    console.log('--- PHASE 3.8 RECONCILIATION & STATE MACHINE TESTS ---');
    
    // 0. CLEANUP
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('active_orders').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('active_positions').delete().eq('robot_id', robotId);

    const { SetupManager } = require('../src/core/engine/runtime/SetupManager');
    const { ReconciliationJob } = require('../src/worker/jobs/ReconciliationJob');

    async function sendWebhook(setup_id, event) {
        const payload = { setup_id, event, trigger: 60000, stop: 59000, eventTimestamp: Date.now(), direction: 'LONG' };
        return await SetupManager.handleSetupEvent(robotId, payload);
    }

    // 1. ARM -> FIRE -> STOP
    console.log('\nTest 1: ARM -> FIRE -> STOP');
    const s1 = 'S1_' + Date.now();
    await sendWebhook(s1, 'ARM');
    await sendWebhook(s1, 'FIRE');
    await sendWebhook(s1, 'STOP');
    const { data: c1 } = await supabase.from('active_setups').select('*').eq('setup_id', s1);
    console.log(`Result: active_setups count = ${c1.length} (Expected: 0) ->`, c1.length === 0 ? 'PASS' : 'FAIL');

    // 2. ARM -> CANCEL
    console.log('\nTest 2: ARM -> CANCEL');
    const s2 = 'S2_' + Date.now();
    await sendWebhook(s2, 'ARM');
    await sendWebhook(s2, 'CANCEL');
    const { data: c2 } = await supabase.from('active_setups').select('*').eq('setup_id', s2);
    console.log(`Result: active_setups count = ${c2.length} (Expected: 0) ->`, c2.length === 0 ? 'PASS' : 'FAIL');

    // 3. Duplicate ARM
    console.log('\nTest 3: Duplicate ARM');
    const s3 = 'S3_' + Date.now();
    await sendWebhook(s3, 'ARM');
    const r3 = await sendWebhook(s3, 'ARM'); // should succeed (idempotent)
    const { data: c3 } = await supabase.from('active_setups').select('*').eq('setup_id', s3);
    console.log(`Result: Success = ${r3.success}, count = ${c3.length} (Expected: true, 1) ->`, r3.success && c3.length === 1 ? 'PASS' : 'FAIL');

    // 4. Duplicate FIRE
    console.log('\nTest 4: Duplicate FIRE');
    const s4 = 'S4_' + Date.now();
    await sendWebhook(s4, 'ARM');
    await sendWebhook(s4, 'FIRE');
    const r4 = await sendWebhook(s4, 'FIRE'); // should succeed
    const { data: c4 } = await supabase.from('active_setups').select('*').eq('setup_id', s4);
    console.log(`Result: Success = ${r4.success}, state = ${c4[0].state} (Expected: true, ACTIVE) ->`, r4.success && c4[0].state === 'ACTIVE' ? 'PASS' : 'FAIL');

    // 5. FILLED + CRASH (Reconciliation)
    console.log('\nTest 5: FILLED + Crash (Reconciliation)');
    const s5 = 'S5_' + Date.now();
    
    // Simulate crash AFTER intent and order are FILLED and position is inserted, but BEFORE cleanup
    const { data: intent } = await supabase.from('execution_intents').insert({ 
        robot_id: robotId, signal_id: s5, setup_id: s5, client_order_id: s5, action: 'OPEN', symbol: 'BTCUSDT', order_type: 'MARKET', quantity: 1, leverage: 1, status: 'FILLED' 
    }).select('id').single();
    
    const { data: order } = await supabase.from('active_orders').insert({ 
        intent_id: intent.id, robot_id: robotId, setup_id: s5, binance_order_id: s5, client_order_id: s5, symbol: 'BTCUSDT', side: 'BUY', order_type: 'MARKET', quantity: 1, status: 'FILLED', role: 'ENTRY' 
    }).select('id').single();
    
    await supabase.from('active_positions').insert({ 
        robot_id: robotId, setup_id: s5, symbol: 'BTCUSDT', quantity: 1, entry_price: 60000, leverage: 1, side: 'LONG' 
    });

    console.log(`Simulated Crash. Executing ReconciliationJob...`);
    await ReconciliationJob.run();

    const { count: countOrders } = await supabase.from('active_orders').select('*', { count: 'exact', head: true }).eq('setup_id', s5);
    const { count: countIntents } = await supabase.from('execution_intents').select('*', { count: 'exact', head: true }).eq('setup_id', s5);
    const { count: countPositions } = await supabase.from('active_positions').select('*', { count: 'exact', head: true }).eq('setup_id', s5);

    console.log(`active_orders = ${countOrders} (Expected: 0) ->`, countOrders === 0 ? 'PASS' : 'FAIL');
    console.log(`execution_intents = ${countIntents} (Expected: 0) ->`, countIntents === 0 ? 'PASS' : 'FAIL');
    console.log(`active_positions = ${countPositions} (Expected: 1) ->`, countPositions === 1 ? 'PASS' : 'FAIL');
}

runE2E();
