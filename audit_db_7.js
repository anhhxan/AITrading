const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '00bf1f08-9fbd-47f0-94b4-23eba7158baf';
    
    console.log("=== CHECKING robot_commands ===");
    const { data: cmds } = await supabase.from('robot_commands').select('*').order('created_at', { ascending: false }).limit(50);
    if (cmds) {
        const match = cmds.filter(c => JSON.stringify(c).includes(testId));
        console.log(match);
        if (match.length > 0) {
            const correlationId = match[0].correlation_id;
            console.log("\n=== CHECKING core_events for correlationId:", correlationId, "===");
            const { data: evts } = await supabase.from('core_events').select('event_type, event_sequence, created_at, payload').eq('correlation_id', correlationId).order('created_at', { ascending: true });
            console.log(evts ? evts.map(e => `${e.event_sequence}: ${e.event_type}`) : "No events found");
        }
    }
}
run();
