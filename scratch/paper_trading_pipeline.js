require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '6e7a371d-dc97-4f07-b804-ee89518a898b';
const webhookSecret = process.env.TV_WEBHOOK_SECRET;

async function sendWebhook(setup_id, event, direction = 'LONG') {
    const payload = {
        secret: webhookSecret,
        setup_id,
        direction,
        state: event === 'ARM' ? (direction + '_ARM') : (direction + '_ACTIVE'),
        symbol: 'BINANCE:BTCUSDT',
        timeframe: '15',
        barTimestamp: Date.now() - 1000,
        eventTimestamp: Date.now(),
        bands: { B1: 61000, B2: 60500, B3: 60000, B4: 59500, B5: 59000 },
        trigger: 60000,
        stop: 59000,
        event
    };

    const res = await fetch(`http://localhost:3000/api/webhook/tv/${robotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log(`[Webhook Response] ${event} -> ${res.status}:`, data);
    return data;
}

async function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function verifyState(testName, setup_id, expected) {
    console.log(`\n[${testName}] Verifying state for ${setup_id}...`);
    // wait for worker to process
    await delay(3000); 

    const { data: setups } = await supabase.from('active_setups').select('*').eq('setup_id', setup_id);
    const { data: intents } = await supabase.from('execution_intents').select('*').eq('setup_id', setup_id);
    const { data: orders } = await supabase.from('active_orders').select('*').eq('setup_id', setup_id);
    const { data: positions } = await supabase.from('active_positions').select('*').eq('setup_id', setup_id);
    const { data: history } = await supabase.from('trade_history').select('*').eq('setup_id', setup_id);

    console.log(`- active_setups: ${setups.length} (Expected: ${expected.setups})`);
    if (setups.length > 0) console.log(`  State: ${setups[0].state}`);
    console.log(`- execution_intents: ${intents.length} (Expected: ${expected.intents})`);
    console.log(`- active_orders: ${orders.length} (Expected: ${expected.orders})`);
    console.log(`- active_positions: ${positions.length} (Expected: ${expected.positions})`);
    console.log(`- trade_history: ${history.length} (Expected: ${expected.history})`);

    const passed = setups.length === expected.setups &&
                   intents.length === expected.intents &&
                   orders.length === expected.orders &&
                   positions.length === expected.positions &&
                   history.length === expected.history;

    if (!passed) {
        console.error(`❌ TEST FAILED: ${testName}`);
        process.exit(1);
    } else {
        console.log(`✅ TEST PASSED: ${testName}`);
    }
}

async function run() {
    console.log('--- STARTING PAPER TRADING CONTROLLED TEST ---\n');

    // TEST 1: ARM -> FIRE -> STOP
    const s1 = 'S1_' + Date.now();
    await sendWebhook(s1, 'ARM');
    await delay(1000);
    await verifyState('Test 1: ARM', s1, { setups: 1, intents: 0, orders: 0, positions: 0, history: 0 });
    
    await sendWebhook(s1, 'FIRE');
    await delay(1000); // FIRE creates position. Engine deletes intents/orders
    await verifyState('Test 1: FIRE', s1, { setups: 1, intents: 0, orders: 0, positions: 1, history: 0 });

    await sendWebhook(s1, 'STOP');
    await delay(1000); // STOP closes position, moves to history
    await verifyState('Test 1: STOP', s1, { setups: 0, intents: 0, orders: 0, positions: 0, history: 1 });


    // TEST 2: ARM -> CANCEL
    const s2 = 'S2_' + Date.now();
    await sendWebhook(s2, 'ARM');
    await delay(1000);
    await verifyState('Test 2: ARM', s2, { setups: 1, intents: 0, orders: 0, positions: 0, history: 0 });
    
    await sendWebhook(s2, 'CANCEL');
    await verifyState('Test 2: CANCEL', s2, { setups: 0, intents: 0, orders: 0, positions: 0, history: 0 });


    // TEST 3: Duplicate ARM / FIRE
    const s3 = 'S3_' + Date.now();
    await sendWebhook(s3, 'ARM');
    await sendWebhook(s3, 'ARM');
    await sendWebhook(s3, 'ARM');
    await delay(1000);
    await verifyState('Test 3: Duplicate ARM', s3, { setups: 1, intents: 0, orders: 0, positions: 0, history: 0 });
    
    await sendWebhook(s3, 'FIRE');
    await sendWebhook(s3, 'FIRE');
    await sendWebhook(s3, 'FIRE');
    await delay(1000);
    await verifyState('Test 3: Duplicate FIRE', s3, { setups: 1, intents: 0, orders: 0, positions: 1, history: 0 });
    await sendWebhook(s3, 'STOP');


    // TEST 4: FIRE không có ARM
    const s4 = 'S4_' + Date.now();
    const fireRes = await sendWebhook(s4, 'FIRE');
    console.log(`Sent FIRE without ARM. Webhook Response:`, fireRes);
    await delay(2000);
    await verifyState('Test 4: FIRE without ARM', s4, { setups: 0, intents: 0, orders: 0, positions: 0, history: 0 });


    // TEST 5: LONG -> STOP -> SHORT Reversal
    const s5_long = 'S5_LONG_' + Date.now();
    const s5_short = 'S5_SHORT_' + Date.now();
    
    await sendWebhook(s5_long, 'ARM', 'LONG');
    await sendWebhook(s5_long, 'FIRE', 'LONG');
    await verifyState('Test 5: LONG Active', s5_long, { setups: 1, intents: 0, orders: 0, positions: 1, history: 0 });
    
    // Simulate tick where STOP Long and ARM Short hit simultaneously
    console.log('Sending STOP LONG and ARM SHORT almost simultaneously...');
    await Promise.all([
        sendWebhook(s5_long, 'STOP', 'LONG'),
        sendWebhook(s5_short, 'ARM', 'SHORT')
    ]);
    await delay(2000);
    
    const { data: setupsLive } = await supabase.from('active_setups').select('*').eq('robot_id', robotId);
    console.log(`Live Setups Count: ${setupsLive.length}`);
    if (setupsLive.length !== 1 || setupsLive[0].setup_id !== s5_short) {
        console.error('❌ Reversal Test Failed: Should only have the SHORT setup active.');
        process.exit(1);
    } else {
        console.log('✅ Reversal Test Passed: Only ONE setup active.');
    }
    await verifyState('Test 5: SHORT Armed', s5_short, { setups: 1, intents: 0, orders: 0, positions: 0, history: 0 });
    await verifyState('Test 5: LONG Stopped', s5_long, { setups: 0, intents: 0, orders: 0, positions: 0, history: 1 });
    await sendWebhook(s5_short, 'CANCEL', 'SHORT');


    // TEST 6: Crash Recovery & Reconciliation
    const s6 = 'S6_' + Date.now();
    await sendWebhook(s6, 'ARM');
    await sendWebhook(s6, 'FIRE');
    await delay(3000);
    
    console.log('\n[Test 6: Crash Recovery & Reconciliation]');
    // Note: The position should be OPEN right now.
    // Insert "orphaned" intents and orders manually to simulate a crash before the ExecutionEngine cleans them up.
    console.log('Simulating crash remnants...');
    const { data: intent } = await supabase.from('execution_intents').insert({ 
        robot_id: robotId, signal_id: s6, setup_id: s6, client_order_id: s6, action: 'OPEN', symbol: 'BTCUSDT', order_type: 'MARKET', quantity: 1, leverage: 1, status: 'FILLED' 
    }).select('id').single();
    
    const { data: order } = await supabase.from('active_orders').insert({ 
        intent_id: intent.id, robot_id: robotId, setup_id: s6, binance_order_id: s6, client_order_id: s6, symbol: 'BTCUSDT', side: 'BUY', order_type: 'MARKET', quantity: 1, status: 'FILLED', role: 'ENTRY' 
    }).select('id').single();

    // Verify before reconciliation
    const { count: cOrd } = await supabase.from('active_orders').select('*', { count: 'exact', head: true }).eq('setup_id', s6);
    console.log(`Pre-reconciliation active_orders: ${cOrd} (Expected: 1)`);

    // Run reconciliation manually
    const { ReconciliationJob } = require('../src/worker/jobs/ReconciliationJob');
    console.log('Running ReconciliationJob...');
    await ReconciliationJob.run();

    await verifyState('Test 6: Reconciliation Cleanup', s6, { setups: 1, intents: 0, orders: 0, positions: 1, history: 0 });

    // Clean up
    await sendWebhook(s6, 'STOP');
    await delay(2000);

    console.log('\n✅ ALL PAPER TRADING PIPELINE TESTS PASSED!');
    process.exit(0);
}

run();
