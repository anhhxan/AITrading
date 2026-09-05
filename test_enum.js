const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { error } = await supabase.from('active_setups').insert([
        { robot_id: 'e0d00614-dfcc-4948-b840-340bfa0f8707', setup_id: 'test', state: 'WAIT_CANDLE_B_CONFIRMATION', direction: 'LONG' }
    ]);
    console.log("Insert state test:", error);
    await supabase.from('active_setups').delete().eq('robot_id', 'e0d00614-dfcc-4948-b840-340bfa0f8707');
}
run();
