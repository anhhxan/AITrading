const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = 'a4a34d4f-505e-4086-9557-240cc11c9bde';
    console.log("=== CHECKING robot_commands ===");
    const { data: cmd } = await supabase.from('robot_commands').select('*').contains('result', { testId }).single();
    console.log(cmd);
    
    if (cmd) {
        console.log("=== CHECKING core_events by testId ===");
        const { data: evts1 } = await supabase.from('core_events').select('event_type, event_sequence, created_at, correlation_id').eq('correlation_id', testId).order('created_at', { ascending: true });
        console.log("Events for testId:", evts1.length);
        
        console.log("=== CHECKING core_events by correlation_id ===");
        const { data: evts2 } = await supabase.from('core_events').select('event_type, event_sequence, created_at, correlation_id, payload').eq('correlation_id', cmd.correlation_id).order('created_at', { ascending: true });
        console.log("Events for correlation_id:", evts2);
        
        console.log("=== CHECKING signal_trace_events ===");
        const { data: trace } = await supabase.from('signal_trace_events').select('*').eq('correlation_id', cmd.correlation_id);
        console.log("Trace:", trace);
    }
}
run();
