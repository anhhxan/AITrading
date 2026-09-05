const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmds, error: cmdErr } = await supabase.from('robot_commands')
        .select('command_id, created_at, status, correlation_id, payload, result')
        .order('created_at', { ascending: false })
        .limit(3);
    
    cmds?.forEach(cmd => {
        console.log(`\nCMD: ${cmd.command_id} at ${cmd.created_at} | Status: ${cmd.status} | Corr: ${cmd.correlation_id}`);
        console.log(`Payload stringified: ${JSON.stringify(cmd.payload).substring(0, 150)}...`);
    });
}
run();
