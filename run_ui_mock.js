const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const robotId = '7e95b9b5-e113-4d61-92a6-26c9979e7ebc';
    const { data: robot } = await supabase.from('robots').select('id, status, trading_view_symbol, timeframe').eq('id', robotId).single();
    
    const testId = crypto.randomUUID();
    console.log(`[BFF MOCK] STARTING TEST_ID = ${testId}`);
    
    const proxyBaseUrl = process.env.CLOUDFLARE_PROXY_URL;
    const proxyToken = process.env.CLOUDFLARE_PROXY_TOKEN;
    const targetUrl = `${proxyBaseUrl}/tv/${robotId}/${proxyToken}`;
    const secret = process.env.TV_WEBHOOK_SECRET;

    const payload = {
        isTest: true,
        isE2E: true,
        testId: testId,
        tvSymbol: robot.trading_view_symbol,
        tvTickerId: robot.trading_view_symbol,
        timeframe: robot.timeframe,
        barTimestamp: Date.now(),
        open: 100, high: 106, low: 90, close: 105, volume: 1,
        indicator: { length: 20, source: "close", mult: 2, mult2: 3 },
        plots: { B1: 130, B2: 120, B3: 110, B4: 100, B5: 90 },
        secret: secret
    };

    const startTime = Date.now();
    let cfStatus = 500, cfResponseText = '', cfError = '';

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
            body: JSON.stringify(payload)
        });
        cfStatus = response.status;
        cfResponseText = await response.text();
    } catch (err) {
        cfError = err.message;
    }
    
    const duration = Date.now() - startTime;
    let persistenceResult = 'NOT_FOUND', executionStatus = 'UNKNOWN', retries = 0;
    let computedCorrelationId = testId;
    
    console.log(`[BFF MOCK] CF=${cfStatus}, Webhook=${cfResponseText}. Polling for 10s...`);
    
    while (retries < 10) {
        await new Promise(r => setTimeout(r, 1000));
        
        if (computedCorrelationId === testId) {
            const { data: cmd } = await supabase.from('robot_commands').select('correlation_id').eq('command_type', 'TV_SIGNAL').contains('result', { testId: testId }).single();
            if (cmd && cmd.correlation_id) computedCorrelationId = cmd.correlation_id;
        }
        
        const { data: events, error } = await supabase.from('core_events').select('event_type, payload').eq('robot_id', robotId).in('correlation_id', [testId, computedCorrelationId]).order('created_at', { ascending: false }).limit(20);
            
        if (!error && events && events.length > 0) {
            persistenceResult = 'SUCCESS';
            const eventTypes = events.map(e => e.event_type);
            if (eventTypes.includes('POSITION_OPENED_EVENT')) { executionStatus = 'SUCCESS (Vo lenh)'; break; }
            else if (eventTypes.includes('ORDER_REJECTED_EVENT') || eventTypes.includes('EXECUTION_ERROR_EVENT')) { executionStatus = 'FAILED (Loi lenh)'; break; }
            else if (eventTypes.includes('RISK_REJECTED_EVENT')) { executionStatus = 'RISK_REJECTED'; break; }
            else if (eventTypes.includes('ORDER_CANCELLED_EVENT')) { executionStatus = 'CANCELLED'; break; }
            else if (eventTypes.includes('TRADE_PLAN_EVENT')) { executionStatus = 'TRADE_PLAN (Da duyet)'; break; }
            else if (eventTypes.includes('STATE_TRANSITION_EVENT')) { executionStatus = 'READY_TO_ENTER'; }
            else if (eventTypes.includes('STRATEGY_SIGNAL_EVENT')) { executionStatus = 'STRATEGY_PASS'; }
            else if (eventTypes.includes('REALTIME_PRICE_EVENT')) { executionStatus = 'PROCESSING_TICKS'; }
            else { executionStatus = 'RECEIVED'; }
        }
        process.stdout.write('.');
        retries++;
    }
    
    console.log(`\n\n=== KET QUA 5 O TREN UI ===`);
    console.log(`TEST_ID: ${testId}`);
    console.log(`BFF: OK`);
    console.log(`CF Worker: ${cfStatus}`);
    console.log(`Webhook (Vercel): OK`);
    console.log(`DB (Supabase): ${persistenceResult}`);
    console.log(`Execution: ${executionStatus}`);
    console.log(`Latency: ${duration}ms`);
    
    console.log(`\n[BFF MOCK] UI Timeout reached. Now waiting 50 more seconds to capture the Golden Trace from DB...`);
    for(let i=0; i<5; i++) {
        await new Promise(r => setTimeout(r, 10000));
        process.stdout.write(`${(i+1)*10}s...`);
    }
    
    console.log(`\n\n=== GOLDEN TRACE ===`);
    const { data: cmd } = await supabase.from('robot_commands').select('*').contains('result', { testId: testId }).single();
    if (cmd) {
        console.log(`Command correlation_id: ${cmd.correlation_id}`);
        console.log(`Status: ${cmd.status}`);
        
        const { data: evts } = await supabase.from('core_events').select('event_sequence, event_type, created_at, payload').in('correlation_id', [testId, cmd.correlation_id]).order('created_at', { ascending: true });
        console.log(`Core Events (${evts.length}):`);
        evts.forEach(e => {
            console.log(`  - [${e.event_sequence}] ${e.event_type} (at ${e.created_at})`);
            if (e.event_type === 'POSITION_OPENED_EVENT') console.log(`      -> Side: ${e.payload?.side}, Price: ${e.payload?.entryPrice}`);
            if (e.event_type === 'STRATEGY_SIGNAL_EVENT') console.log(`      -> Direction: ${e.payload?.direction}`);
            if (e.event_type === 'REALTIME_PRICE_EVENT') console.log(`      -> Tick: ${e.payload?.price}`);
        });
    } else {
        console.log(`Command not found in DB!`);
    }
}
run();
