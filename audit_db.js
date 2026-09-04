const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '114ac833-cdf7-4ae8-a61f-f4243097dd6c';
    console.log("=== CHECKING robot_commands ===");
    const { data: cmds, error: cmdErr } = await supabase.from('robot_commands').select('*').order('created_at', { ascending: false }).limit(20);
    console.log(cmds ? cmds.filter(c => JSON.stringify(c).includes(testId)) : cmdErr);

    console.log("=== CHECKING core_events ===");
    const { data: evts, error: evErr } = await supabase.from('core_events').select('event_type, payload').order('created_at', { ascending: false }).limit(50);
    console.log(evts ? evts.filter(e => JSON.stringify(e).includes(testId)).map(e => e.event_type) : evErr);
}
run();
