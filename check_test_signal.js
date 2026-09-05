const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = 'd4d22e8a-c781-4342-a553-f15128a42be5';
    
    console.log("=== ROBOT COMMANDS ===");
    const { data: cmds, error: cmdErr } = await supabase.from('robot_commands')
        .select('*')
        .or(`payload->>testId.eq.${testId},correlation_id.ilike.%${testId}%`)
        .order('created_at', { ascending: false });
        
    if (cmdErr) console.error(cmdErr);
    
    if (cmds && cmds.length > 0) {
        const cmd = cmds[0];
        console.log("command_id:", cmd.command_id);
        console.log("robot_id:", cmd.robot_id);
        console.log("status:", cmd.status);
        console.log("worker_id:", cmd.worker_id);
        console.log("claimed_at:", cmd.processing_started_at);
        console.log("processed_at:", cmd.processed_at);
        console.log("correlation_id:", cmd.correlation_id);
        console.log("result status:", cmd.result?.status || cmd.result);
        console.log("execution:", cmd.result?.execution);
        
        console.log("\n=== CORE EVENTS ===");
        const { data: events } = await supabase.from('core_events')
            .select('event_type, created_at, payload')
            .eq('correlation_id', cmd.correlation_id)
            .order('created_at', { ascending: true });
        
        events?.forEach(e => console.log(`${e.event_type} at ${e.created_at}`));
        
        console.log("\n=== SIGNAL TRACE EVENTS ===");
        const { data: traces } = await supabase.from('signal_trace_events')
            .select('*')
            .eq('robot_id', cmd.robot_id)
            .order('created_at', { ascending: false })
            .limit(5);
        traces?.forEach(t => console.log(`${t.bar_timestamp} | ${t.strategy_status} | ${t.strategy_result} | ${JSON.stringify(t.diagnostics)}`));

        console.log("\n=== ACTIVE SETUPS ===");
        const { data: setups } = await supabase.from('active_setups')
            .select('state, direction, is_armed, setup_id')
            .eq('robot_id', cmd.robot_id);
        setups?.forEach(s => console.log(`Setup: ${s.state} | ${s.direction} | armed: ${s.is_armed}`));

        console.log("\n=== EXECUTION ===");
        const { data: intents } = await supabase.from('execution_intents')
            .select('*')
            .eq('robot_id', cmd.robot_id)
            .order('created_at', { ascending: false })
            .limit(2);
        intents?.forEach(i => console.log(`Intent: ${i.status} | ${i.side}`));
    } else {
        console.log("No command found containing testId.");
    }
}
run();
