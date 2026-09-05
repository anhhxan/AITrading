const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
    
    // Simulate first signal upsert
    let res = await supabase.from('active_setups').upsert({
        robot_id: robotId,
        setup_id: robotId,
        state: 'WAIT_CANDLE_B_CONFIRMATION',
        direction: 'LONG',
        trigger_price: 60000,
        snapshot: { test: 1 },
        is_armed: false
    });
    console.log("Upsert 1:", res.error);
    
    // Simulate second signal (duplicate/new) upsert
    res = await supabase.from('active_setups').upsert({
        robot_id: robotId,
        setup_id: robotId,
        state: 'WAIT_CANDLE_B_CONFIRMATION',
        direction: 'SHORT',
        trigger_price: 65000,
        snapshot: { test: 2 },
        is_armed: false
    });
    console.log("Upsert 2:", res.error);
    
    // Check how many rows
    const { data } = await supabase.from('active_setups').select('*').eq('robot_id', robotId);
    console.log("Rows count:", data.length);
    console.log("Snapshot:", data[0].snapshot);
    
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
}
run();
