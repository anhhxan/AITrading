const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmds } = await supabase.from('robot_commands')
        .select('command_id, created_at, processing_started_at, processed_at, status, worker_id, result')
        .order('created_at', { ascending: false })
        .limit(10);
    
    console.log("=== NEWEST COMMANDS ===");
    console.log(JSON.stringify(cmds, null, 2));

    const { data: ea43 } = await supabase.from('robot_commands')
        .select('command_id, created_at, processing_started_at, processed_at, status, worker_id, result')
        .eq('command_id', 'ea43259d-5964-419e-a059-933a25336090')
        .single();
    console.log("=== ea43259d STATUS ===");
    console.log(JSON.stringify(ea43, null, 2));
}
run();
