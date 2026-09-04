const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 1. Get the latest successful command
    const { data: commands } = await supabase.from('robot_commands')
        .select('*')
        .eq('status', 'SUCCEEDED')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (!commands || commands.length === 0) {
        console.log("No commands found.");
        return;
    }
    const cmd = commands[0];
    console.log("COMMAND:", cmd);

    // 2. Get the corresponding trace
    const { data: traces } = await supabase.from('signal_trace_events')
        .select('*')
        .eq('robot_id', cmd.robot_id)
        .gte('created_at', cmd.created_at)
        .order('created_at', { ascending: true })
        .limit(2);
    
    console.log("TRACES:", traces);
    
    // 3. Get any core_events for this robot around this time
    const { data: events } = await supabase.from('core_events')
        .select('*')
        .eq('robot_id', cmd.robot_id)
        .gte('timestamp', cmd.created_at)
        .order('timestamp', { ascending: true })
        .limit(5);
        
    console.log("CORE EVENTS:", events);
}
run();
