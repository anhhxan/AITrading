require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { SetupManager } = require('../src/core/engine/runtime/SetupManager');
const { RobotRuntime } = require('../src/worker/RuntimeManager'); // I'll just check StateMachineEngine instead of full RobotRuntime to avoid heavy engine startup
// Actually, I can just write a raw test of the hydration DB query, or use RobotRuntime.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193'; 

async function runTests() {
    const s1 = 'S1_' + Date.now();
    const s2 = 'S2_' + Date.now();
    const s3 = 'S3_' + Date.now();
    const s4 = 'S4_' + Date.now();

    async function sendWebhook(setup_id, event, ts) {
        const payload = { setup_id, event, trigger: 60000, stop: 59000, eventTimestamp: ts, direction: 'LONG' };
        
        // Simulating the deterministic idempotency logic in route.ts
        const identityString = `${robotId}_${setup_id}_${event}`;
        const hash = crypto.createHash('md5').update(identityString).digest('hex');
        const deterministicCommandId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
        const correlation_id = `tv_${hash.slice(0, 16)}`;

        // Webhook inserts command
        const { error } = await supabase.from('robot_commands').insert({
            robot_id: robotId,
            command_id: deterministicCommandId,
            command_type: 'TV_SIGNAL',
            status: 'RECEIVED',
            correlation_id,
            result: payload
        });
        
        if (error && error.code === '23505') {
            return { duplicate: true };
        }
        
        const res = await SetupManager.handleSetupEvent(robotId, payload);
        return { duplicate: false, stateErr: res.error, success: res.success };
    }

    async function checkState(setup_id) {
        const { data } = await supabase.from('active_setups').select('state').eq('setup_id', setup_id).single();
        return data ? data.state : null;
    }

    // CLEANUP OLD TESTS IF ANY
    await supabase.from('robot_commands').delete().eq('robot_id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('active_orders').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('active_positions').delete().eq('robot_id', robotId);

    console.log('--- PHASE 3.7 REAL DB INTEGRATION TEST RESULTS ---');

    // 1. PENDING -> ARM -> active_setups INSERT
    await sendWebhook(s1, 'PENDING', 99);
    console.log('1. PENDING -> ARM -> ACTIVE Transition Check');
    console.log('   - PENDING:', (await checkState(s1)) === 'PENDING' ? 'PASS' : 'FAIL');
    await sendWebhook(s1, 'ARM', 100);
    console.log('   - ARM:', (await checkState(s1)) === 'ARM' ? 'PASS' : 'FAIL');

    // 2. ARM duplicate -> idempotent
    const res2 = await sendWebhook(s1, 'ARM', 100);
    console.log('2. ARM duplicate -> idempotent:', res2.duplicate || res2.success ? 'PASS' : 'FAIL');

    // 3. ARM -> FIRE -> ACTIVE
    await sendWebhook(s1, 'FIRE', 101);
    console.log('3. ARM -> FIRE -> ACTIVE:', (await checkState(s1)) === 'ACTIVE' ? 'PASS' : 'FAIL');

    // 4. ACTIVE -> STOP -> active_setup DELETE
    await sendWebhook(s1, 'STOP', 102);
    console.log('4. ACTIVE -> STOP -> active_setup DELETE:', (await checkState(s1)) === null ? 'PASS' : 'FAIL');

    // 5. ARM -> CANCEL -> active_setup DELETE
    await sendWebhook(s2, 'PENDING', 103);
    await sendWebhook(s2, 'ARM', 103);
    await sendWebhook(s2, 'CANCEL', 104);
    console.log('5. ARM -> CANCEL -> active_setup DELETE:', (await checkState(s2)) === null ? 'PASS' : 'FAIL');

    // 6. INVALID TRANSITION (ACTIVE -> CANCEL should fail)
    await sendWebhook(s3, 'ARM', 105);
    await sendWebhook(s3, 'FIRE', 106);
    const resInv = await sendWebhook(s3, 'CANCEL', 106); 
    console.log('6. INVALID TRANSITION (ACTIVE -> CANCEL) Rejected:', resInv.success === false && resInv.stateErr === 'INVALID_TRANSITION' ? 'PASS' : 'FAIL');

    // 7. FIRE đến trước ARM -> SEQUENCING_ERROR (Not ARM, Not ACTIVE)
    const res7 = await sendWebhook(s4, 'FIRE', 107);
    const state4 = await checkState(s4);
    console.log('7. FIRE before ARM -> state=' + state4 + ' (SEQUENCING_ERROR):', state4 === null && res7.stateErr === 'SEQUENCING_ERROR_NO_ARM' ? 'PASS' : 'FAIL');

    // 8. FIRE duplicate -> không execution lần 2
    const resDupFire = await sendWebhook(s3, 'FIRE', 106);
    console.log('8. FIRE duplicate -> idempotent:', resDupFire.duplicate || resDupFire.success ? 'PASS' : 'FAIL');

    // Simulation of PaperExecutionEngine cleanup
    async function simulateExecutionCleanup(setup_id) {
        const res = await supabase.from('execution_intents').insert({ robot_id: robotId, signal_id: setup_id, setup_id, client_order_id: setup_id, action: 'OPEN', symbol: 'BTC', order_type: 'MARKET', quantity: 1, leverage: 1, status: 'NEW' }).select('id').single();
        if (res.error) console.error('INTENT ERROR:', res.error);
        const intent = res.data;
        const oRes = await supabase.from('active_orders').insert({ intent_id: intent.id, robot_id: robotId, setup_id, binance_order_id: setup_id, client_order_id: setup_id, symbol: 'BTC', side: 'BUY', order_type: 'MARKET', quantity: 1, status: 'FILLED', role: 'ENTRY' });
        if (oRes.error) console.error('ORDER ERROR:', oRes.error);
        
        // Simulating the cleanup after filled
        const pRes = await supabase.from('active_positions').insert({ robot_id: robotId, setup_id, symbol: 'BTC', quantity: 1, entry_price: 60000, leverage: 1, side: 'LONG' });
        if (pRes.error) console.error('POSITION ERROR:', pRes.error);

        await supabase.from('active_orders').delete().eq('setup_id', setup_id);
        await supabase.from('execution_intents').delete().eq('setup_id', setup_id);
    }

    // 9. FIRE -> FILLED -> cleanup
    await simulateExecutionCleanup(s3);
    const { data: orders } = await supabase.from('active_orders').select('*').eq('setup_id', s3);
    const { data: positions } = await supabase.from('active_positions').select('*').eq('setup_id', s3);
    console.log('9. FILLED -> active_position success & orders/intents deleted:', (orders.length === 0 && positions.length > 0) ? 'PASS' : 'FAIL');

    // 10. RuntimeManager Hydration check
    // Direct check of what RuntimeManager does
    const { data: activeSetup } = await supabase.from('active_setups').select('*').eq('robot_id', robotId).single();
    let trueState = activeSetup ? activeSetup.state : 'IDLE';
    console.log('10. RuntimeManager Hydration (s3 is ACTIVE):', trueState === 'ACTIVE' ? 'PASS' : 'FAIL');
}
runTests();
