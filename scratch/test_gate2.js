require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';
const webhookSecret = process.env.TV_WEBHOOK_SECRET;

async function sendWebhook(barTimestamp, closePrice) {
    const payload = {
        secret: webhookSecret,
        tvSymbol: 'BINANCE:BTCUSDT',
        tvTickerId: 'BINANCE:BTCUSDT',
        timeframe: '15',
        barTimestamp: barTimestamp,
        open: closePrice,
        high: closePrice + 100,
        low: closePrice - 100,
        close: closePrice,
        volume: 100,
        indicator: {
            length: 20,
            source: 'close',
            mult: 2.5,
            mult2: 1.3
        },
        plots: { B1: 90000, B2: 85000, B3: 10000, B4: -10000, B5: -20000 },
        isTest: false
    };

    const res = await fetch(`http://localhost:3000/api/webhook/tv/${robotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log(`[Webhook Response] ${res.status}:`, data);
    return data;
}

async function run() {
    // Force state to WAIT_SIGNAL to clear any stuck state
    await supabase.from('robots').update({ current_state: 'WAIT_SIGNAL' }).eq('id', robotId);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);

    const baseTime = Date.now(); // Dynamic!
    
    console.log('\n--- 1. Sending previous candle (SHORT CANDIDATE setup) ---');
    await sendWebhook(baseTime, 95000); // > B1 (90000)
    await new Promise(r => setTimeout(r, 4000));

    console.log('\n--- 2. Sending current candle (SHORT CANDIDATE confirmation) ---');
    // EXACTLY 15m delta
    await sendWebhook(baseTime + 15 * 60 * 1000, 87000); // Between B1 and B2 => Creates signal. armBounds=[10000, 85000], trigger=[76500, +inf].
    await new Promise(r => setTimeout(r, 4000));

    console.log('\n--- 3. Sending price tick (ARM & TRIGGER) ---');
    // EXACTLY another 15m delta (just to be safe) or any delta.
    await sendWebhook(baseTime + 30 * 60 * 1000, 80000); // In armBounds AND in trigger (76.5k-inf).
}

run();
