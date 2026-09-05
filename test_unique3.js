const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';
    let res = await supabase.from('active_setups').insert([
        { robot_id: robotId, setup_id: 's1', state: 'PENDING', direction: 'LONG' }
    ]);
    res = await supabase.from('active_setups').insert([
        { robot_id: robotId, setup_id: 's1', state: 'PENDING', direction: 'SHORT' }
    ]);
    console.log("Insert duplicate setup_id:", res.error);
    await supabase.from('active_setups').delete().eq('robot_id', robotId);
}
run();
