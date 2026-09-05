const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("=== CHECKING LATEST COMMANDS ===");
    const { data: cmds } = await supabase.from('robot_commands').select('command_id, correlation_id, status, result, created_at, processing_started_at').order('created_at', { ascending: false }).limit(3);
    for (const c of cmds) {
        console.log(`Command ID: ${c.command_id} | Status: ${c.status} | Created: ${c.created_at} | Started: ${c.processing_started_at}`);
        if (c.result && c.result.execution) console.log(`  Execution: ${c.result.execution}`);
        
        const { data: evts } = await supabase.from('core_events').select('event_type, event_sequence').eq('correlation_id', c.correlation_id).order('created_at', { ascending: true });
        if (evts && evts.length > 0) {
            console.log(`  Events: ${evts.map(e => e.event_type).join(' -> ')}`);
        } else {
            console.log(`  Events: None`);
        }
    }
}
run();
