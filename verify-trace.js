require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: events } = await supabase
        .from('core_events')
        .select('event_type, timestamp, payload')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .order('timestamp', { ascending: false })
        .limit(10);
    if (events) events.forEach(e => console.log(`[${new Date(e.timestamp).toISOString()}] ${e.event_type}`));

    console.log("\nChecking robot_commands...");
    const { data: cmds } = await supabase
        .from('robot_commands')
        .select('command_type, status, result, created_at')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .order('created_at', { ascending: false })
        .limit(5);
    if (cmds) cmds.forEach(c => console.log(`[${c.created_at}] ${c.command_type} - ${c.status}`));
}
check();
