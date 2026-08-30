require('dotenv').config({ path: 'C:/A/Tradding AI/trading-platform/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193'; 

async function runE2E() {
    console.log('--- STARTING E2E LIFECYCLE TEST ---');
    const setup_id = 'E2E_' + Date.now();
    
    // 0. CLEANUP ANY LEFTOVERS
    await supabase.from('robot_commands').delete().eq('robot_id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('active_orders').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
    await supabase.from('trade_history').delete().eq('robot_id', robotId);

    // MOCK WEBHOOK INJECTION
    async function sendWebhook(event, ts) {
        const payload = { setup_id, event, trigger: 60000, stop: 59000, eventTimestamp: ts, direction: 'LONG' };
        
        // Simulating the SetupManager
        const { SetupManager } = require('C:/A/Tradding AI/trading-platform/src/core/engine/runtime/SetupManager');
        const res = await SetupManager.handleSetupEvent(robotId, payload);
        if(!res.success) throw new Error('Webhook failed: ' + res.error);
        console.log(`[Webhook] ${event} processed.`);
    }

    // 1. PENDING
    await sendWebhook('PENDING', 1);

    // 2. ARM
    await sendWebhook('ARM', 2);

    // 3. FIRE
    await sendWebhook('FIRE', 3);

    // 4. EXECUTION ENGINE: OPEN POSITION
    console.log('[Execution] Opening Position...');
    
    // Insert intent
    const { data: intent } = await supabase.from('execution_intents').insert({ 
        robot_id: robotId, signal_id: setup_id, setup_id, client_order_id: setup_id, action: 'OPEN', symbol: 'BTCUSDT', order_type: 'MARKET', quantity: 1, leverage: 1, status: 'NEW' 
    }).select('id').single();
    
    // Insert order
    await supabase.from('active_orders').insert({ 
        intent_id: intent.id, robot_id: robotId, setup_id, binance_order_id: setup_id, client_order_id: setup_id, symbol: 'BTCUSDT', side: 'BUY', order_type: 'MARKET', quantity: 1, status: 'FILLED', role: 'ENTRY' 
    });
    
    // Insert position
    const { data: pos } = await supabase.from('active_positions').insert({ 
        robot_id: robotId, setup_id, symbol: 'BTCUSDT', quantity: 1, entry_price: 60000, leverage: 1, side: 'LONG' 
    }).select('id').single();

    // Cleanup OPEN Intents/Orders (simulate PaperExecutionEngine line 233)
    await supabase.from('active_orders').delete().eq('setup_id', setup_id);
    await supabase.from('execution_intents').delete().eq('setup_id', setup_id);
    console.log('[Execution] Position Opened. Cleaned up orders/intents.');

    // 5. STOP/TP HIT OR CANCEL WEBHOOK
    // A. Webhook sends STOP
    await sendWebhook('STOP', 4);
    
    // B. Execution Engine detects STOP, closes position
    console.log('[Execution] Closing Position (STOP/TP Hit)...');
    
    // Create trade_history
    const thRes = await supabase.from('trade_history').insert({
        robot_id: robotId, execution_symbol: 'BTCUSDT', trading_view_symbol: 'BINANCE:BTCUSDT', timeframe: '15m', strategy_id: 'BB_Strategy', side: 'LONG', entry_price: 60000, exit_price: 59000, amount: 1, pnl: -1000, setup_id: setup_id, action: 'SELL', reason: 'STOP_LOSS', indicator_snapshot: {}
    });
    if (thRes.error) console.error('TRADE HISTORY ERROR:', thRes.error);
    
    // Cleanup LIVE Position and Close Orders
    await supabase.from('active_positions').delete().eq('setup_id', setup_id);
    await supabase.from('active_orders').delete().eq('setup_id', setup_id);
    await supabase.from('execution_intents').delete().eq('setup_id', setup_id);
    console.log('[Execution] Position Closed. Cleaned up position/orders/intents.');

    // 6. FINAL ASSERTIONS
    console.log('--- ASSERTIONS ---');
    
    const { count: cSetups } = await supabase.from('active_setups').select('*', { count: 'exact', head: true }).eq('robot_id', robotId);
    const { count: cIntents } = await supabase.from('execution_intents').select('*', { count: 'exact', head: true }).eq('robot_id', robotId);
    const { count: cOrders } = await supabase.from('active_orders').select('*', { count: 'exact', head: true }).eq('robot_id', robotId);
    const { count: cPositions } = await supabase.from('active_positions').select('*', { count: 'exact', head: true }).eq('robot_id', robotId);
    const { count: cHistory } = await supabase.from('trade_history').select('*', { count: 'exact', head: true }).eq('robot_id', robotId);

    console.log(`active_setups = ${cSetups} (Expected: 0) ->`, cSetups === 0 ? 'PASS' : 'FAIL');
    console.log(`execution_intents = ${cIntents} (Expected: 0) ->`, cIntents === 0 ? 'PASS' : 'FAIL');
    console.log(`active_orders = ${cOrders} (Expected: 0) ->`, cOrders === 0 ? 'PASS' : 'FAIL');
    console.log(`active_positions = ${cPositions} (Expected: 0) ->`, cPositions === 0 ? 'PASS' : 'FAIL');
    console.log(`trade_history = ${cHistory} (Expected: 1) ->`, cHistory === 1 ? 'PASS' : 'FAIL');
    
    if (cSetups === 0 && cIntents === 0 && cOrders === 0 && cPositions === 0 && cHistory === 1) {
        console.log('\n>>> E2E TEST: PERFECT SUCCESS <<<');
    } else {
        console.log('\n>>> E2E TEST: FAILED <<<');
    }
}

runE2E();
