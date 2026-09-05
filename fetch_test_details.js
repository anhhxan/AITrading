const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const cmdId = 'e25a26e7-108c-47ae-a789-37b5d58ef3d4';
    const { data: cmd } = await supabase.from('robot_commands').select('*').eq('command_id', cmdId).single();
    
    console.log("=== COMMAND ===");
    console.log("command_id:", cmd.command_id);
    console.log("robot_id:", cmd.robot_id);
    console.log("created_at:", cmd.created_at);
    console.log("status:", cmd.status);
    console.log("worker_id:", cmd.worker_id);
    console.log("claimed_at:", cmd.processing_started_at);
    console.log("processed_at:", cmd.processed_at);
    console.log("correlation_id:", cmd.correlation_id);
    console.log("result:", JSON.stringify(cmd.result));

    console.log("\n=== CORE EVENTS ===");
    const { data: events } = await supabase.from('core_events')
        .select('event_type, created_at')
        .eq('correlation_id', cmd.correlation_id)
        .order('created_at', { ascending: true });
    events?.forEach(e => console.log(`${e.event_type} at ${e.created_at}`));
    if (!events || events.length === 0) console.log("None");

    console.log("\n=== SIGNAL TRACE ===");
    const { data: traces } = await supabase.from('signal_trace_events')
        .select('*')
        .eq('robot_id', cmd.robot_id)
        .order('created_at', { ascending: false })
        .limit(3);
    traces?.forEach(t => console.log(`${t.bar_timestamp} | ${t.strategy_status} | ${t.strategy_result} | ${JSON.stringify(t.diagnostics)}`));

    console.log("\n=== ACTIVE SETUPS ===");
    const { data: setups } = await supabase.from('active_setups')
        .select('state, direction, is_armed, setup_id, trigger_price')
        .eq('robot_id', cmd.robot_id);
    setups?.forEach(s => console.log(`Setup: ${s.state} | ${s.direction} | trigger: ${s.trigger_price} | armed: ${s.is_armed}`));
    if (!setups || setups.length === 0) console.log("None");

    console.log("\n=== PAPER EXECUTION ===");
    const { data: intents } = await supabase.from('execution_intents')
        .select('id, status, side, created_at')
        .eq('robot_id', cmd.robot_id)
        .order('created_at', { ascending: false })
        .limit(2);
    intents?.forEach(i => console.log(`Intent: ${i.status} | ${i.side} at ${i.created_at}`));
    if (!intents || intents.length === 0) console.log("None");
}
run();
