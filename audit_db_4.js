const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '8ab5d9d5-5714-43d6-916d-cd7aa9696fe4';

    console.log("=== CHECKING robot_commands ===");
    const { data: cmds } = await supabase.from('robot_commands').select('*').order('created_at', { ascending: false }).limit(20);
    if (cmds) {
        console.log(cmds.filter(c => JSON.stringify(c).includes(testId)));
    }

    console.log("=== CHECKING core_events ===");
    const { data: evts } = await supabase.from('core_events').select('event_type, payload').eq('correlation_id', testId).order('created_at', { ascending: false });
    if (evts) {
        console.log(evts.map(e => e.event_type));
    }
}
run();
