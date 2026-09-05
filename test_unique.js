const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    await supabase.from('active_setups').insert([
        { robot_id: '11111111-1111-1111-1111-111111111111', setup_id: 's1', state: 'PENDING', direction: 'LONG' },
        { robot_id: '11111111-1111-1111-1111-111111111111', setup_id: 's2', state: 'PENDING', direction: 'SHORT' }
    ]);
    const { error } = await supabase.from('active_setups').insert([
        { robot_id: '11111111-1111-1111-1111-111111111111', setup_id: 's3', state: 'PENDING', direction: 'LONG' }
    ]);
    console.log("Error inserting 3rd:", error);
    await supabase.from('active_setups').delete().eq('robot_id', '11111111-1111-1111-1111-111111111111');
}
run();
