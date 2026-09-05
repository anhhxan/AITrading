const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const cmdId = 'e25a26e7-108c-47ae-a789-37b5d58ef3d4';
    const { data: cmd } = await supabase.from('robot_commands').select('*').eq('command_id', cmdId).single();
    
    console.log("=== COMMAND ===");
    console.log("status:", cmd.status);
    console.log("worker_id:", cmd.worker_id);
    console.log("result:", JSON.stringify(cmd.result));

    console.log("\n=== SIGNAL TRACE ===");
    const { data: traces } = await supabase.from('signal_trace_events')
        .select('*')
        .eq('robot_id', cmd.robot_id)
        .order('created_at', { ascending: false })
        .limit(3);
    traces?.forEach(t => console.log(`${t.bar_timestamp} | ${t.strategy_status} | ${t.strategy_result} | ${JSON.stringify(t.diagnostics)}`));
}
run();
