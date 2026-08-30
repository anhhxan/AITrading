import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSupabaseAdmin } from './src/lib/supabase.ts';
import { RuntimeManager } from './src/worker/RuntimeManager.ts';
import { coreEventBus } from './src/core/infrastructure/EventBus.ts';
import { EventFactory } from './src/core/infrastructure/EventFactory.ts';
import { RobotState } from './src/core/engine/runtime/StateMachineEngine.ts';

const supabase = getSupabaseAdmin();
const crypto = require('crypto'); const robotId = crypto.randomUUID();

async function setupPaperRobot() {
    console.log("== 1. SETUP PAPER ROBOT ==");
    const {data: u} = await supabase.auth.admin.listUsers(); const userId = u.users.length > 0 ? u.users[0].id : null; if(!userId) throw new Error('No user');
    await supabase.from('active_positions').delete().eq('robot_id', robotId);
    await supabase.from('execution_intents').delete().eq('robot_id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    await supabase.from('trade_history').delete().eq('robot_id', robotId);
    await supabase.from('robot_commands').delete().eq('robot_id', robotId);
    await supabase.from('core_events').delete().eq('robot_id', robotId);
    await supabase.from('robot_configs').delete().eq('robot_id', robotId);
    await supabase.from('robots').delete().eq('id', robotId);

    const { error: t3Err } = await supabase.from('robots').insert({
        id: robotId, user_id: userId, name: 'Pine V2 Smoke Test', slug: 'pine-v2-smoke-' + robotId,
        status: 'RUNNING', current_state: 'WAIT_SIGNAL', trading_mode: 'PAPER',
        trading_session: '24/7', signal_source: 'TRADINGVIEW', provider: 'BINANCE',
        trading_view_symbol: 'BINANCE:BTCUSDT', execution_symbol: 'BTCUSDT', timeframe: '1m', 
        trading_enabled: true, paper_balance: 10000,
        indicator_profile: { type: 'BB_MB', length: 20 }, strategy_profile: { type: 'BB_STRATEGY' },
        risk_profile: { stop_loss_pct: 20, position_allocation_percent: 20, leverage: 1 },
        entry_profile: { type: 'MARKET' }, exit_profile: { type: 'FIXED_EXIT' },
        notification_profile: {}
    });
    if (t3Err) throw new Error("Robot insert failed: " + JSON.stringify(t3Err));

    const { error: t3CfgErr } = await supabase.from('robot_configs').insert({
        robot_id: robotId, version: 1, status: 'ACTIVE',
        indicator_profile: { type: 'BB_MB', length: 20, source: 'close', mult: 2.0, mult2: 1.0 }, 
        strategy_profile: { type: 'BB_STRATEGY' },
        risk_profile: { position_allocation_percent: 20, stop_loss_pct: 20 }, entry_profile: {}, exit_profile: {}, notification_profile: {}, created_by: userId
    });
    if (t3CfgErr) throw new Error("Config insert failed: " + JSON.stringify(t3CfgErr));

    console.log("Paper Robot Created:", robotId);
}

async function runPipeline() {
    await setupPaperRobot();
    
    const runtimeManager = new RuntimeManager();
    await runtimeManager.initializeEngines();
    await runtimeManager.getOrCreateRuntime(robotId);
    
    const runtime = (runtimeManager as any).runtimes.get(robotId);
    if (runtime && runtime.priceFeed) {
        runtime.priceFeed.stop();
    }

    console.log("== 2. SIMULATE PINE V2 PAYLOAD ==");
    const payload = {
        tvSymbol: "BINANCE:BTCUSDT",
        tvTickerId: "BINANCE:BTCUSDT",
        timeframe: "1",
        barTimestamp: Date.now(),
        open: 60000,
        high: 61000,
        low: 59000,
        close: 60500,
        volume: 10,
        indicator: { length: 20, source: "close", mult: 2.0, mult2: 1.0 },
        plots: {
            B1: 64000,
            B2: 63000,
            B3: 62000,
            B4: 61000,
            B5: 60000
        }
    };

    const result = await runtimeManager.adapter.handleWebhook(payload, robotId, 'corr-1');
    if (!result.accepted) {
        console.error("Payload rejected:", result.validationErrors);
        process.exit(1);
    }
    console.log("Payload accepted. Publishing events...");

    for (const ev of (result.events || [])) {
        await coreEventBus.publish(ev.eventInstance);
    }
    
    await new Promise(r => setTimeout(r, 3000));
    const state = (runtimeManager.stateMachine as any).states.get(robotId);
    console.log("State after Candle Closed:", state);
    
    if (state !== RobotState.WAIT_CANDLE_B_CONFIRMATION) {
        console.error("FAIL: State is not WAIT_CANDLE_B_CONFIRMATION");
        process.exit(1);
    }

    console.log("== 3. TICK 1: ARM (Tick drops below B4) ==");
    await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, EventFactory.createTrace('corr-1', 'tick-1', 'Test', 3), {
        price: 61500,
        eventTimestamp: Date.now()
    }) as any);
    await new Promise(r => setTimeout(r, 1000));

    console.log("== 4. TICK 2: FIRE (Tick hits B4 + 10%) ==");
    await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, EventFactory.createTrace('corr-1', 'tick-2', 'Test', 4), {
        price: 61050,
        eventTimestamp: Date.now()
    }) as any);
    await new Promise(r => setTimeout(r, 2000));
    
    const finalState = (runtimeManager.stateMachine as any).states.get(robotId);
    console.log("State after FIRE:", finalState);

    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
    if (!pos || pos.length === 0) {
        console.error("FAIL: Position not created.");
        process.exit(1);
    }
    
    console.log("Position Created:", pos[0].side, pos[0].entry_price, pos[0].stop_loss_price);
    console.log("Expected SL: 60800. Actual SL:", pos[0].stop_loss_price);
    
    if (pos[0].stop_loss_price !== 60800) {
        console.error("FAIL: Stop loss mismatch.");
        process.exit(1);
    }

    console.log("== 5. CLEANUP / DB DISCIPLINE ==");
    const { data: setups } = await supabase.from('active_setups').select('*').eq('robot_id', robotId);
    if (setups && setups.length > 0) {
        console.error("FAIL: active_setups not cleaned up!");
        process.exit(1);
    }
    
    const { data: ticks } = await supabase.from('core_events').select('*').eq('robot_id', robotId).eq('event_type', 'REALTIME_PRICE_EVENT');
    if (ticks && ticks.length > 0) {
        console.error("FAIL: REALTIME_PRICE_EVENT inserted into DB!");
        process.exit(1);
    }
    
    console.log("DB discipline PASS (No setups, No tick spam).");
    console.log("ALL TESTS PASS!");
    process.exit(0);
}

runPipeline().catch(console.error);
















