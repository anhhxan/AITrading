const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmd, error: cmdErr } = await supabase.from('robot_commands')
        .select('*')
        .eq('command_id', 'ea43259d-5964-419e-a059-933a25336090')
        .single();
    
    if (cmdErr) {
        console.log("Command fetch error:", cmdErr);
        return;
    }
    
    console.log("=== COMMAND ===");
    console.log("command_id:", cmd.command_id);
    console.log("robot_id:", cmd.robot_id);
    console.log("correlation_id:", cmd.correlation_id);
    console.log("created_at:", cmd.created_at);
    console.log("status:", cmd.status);
    console.log("worker_id:", cmd.worker_id);
    console.log("attempt_count:", cmd.attempt_count);
    console.log("processing_started_at (claimed_at):", cmd.processing_started_at);
    console.log("processed_at:", cmd.processed_at);
    console.log("result type:", typeof cmd.result);
    console.log("has result payload:", !!cmd.result);
    
    // Check events
    const { data: events, error: evErr } = await supabase.from('core_events')
        .select('event_type, event_sequence, created_at')
        .eq('correlation_id', cmd.correlation_id)
        .order('event_sequence', { ascending: true });
        
    console.log("\n=== EVENTS ===");
    if (evErr) {
        console.log("Events fetch error:", evErr);
    } else {
        if (events.length === 0) {
            console.log("NO EVENTS FOUND for correlation_id:", cmd.correlation_id);
        }
        events.forEach(e => {
            console.log(`${e.event_sequence}: ${e.event_type} at ${e.created_at}`);
        });
    }
}
run();
