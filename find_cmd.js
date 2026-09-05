const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmds, error: cmdErr } = await supabase.from('robot_commands')
        .select('command_id, created_at, status, correlation_id, worker_id, result')
        .order('created_at', { ascending: false })
        .limit(10);
    
    cmds?.forEach(cmd => {
        let hasTestId = false;
        const resStr = JSON.stringify(cmd.result || {});
        if (resStr.includes('d4d22e8a')) hasTestId = true;
        console.log(`\nCMD: ${cmd.command_id} at ${cmd.created_at} | Status: ${cmd.status} | Worker: ${cmd.worker_id} | HasTestId: ${hasTestId}`);
    });
}
run();
