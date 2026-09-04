const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '114ac833-cdf7-4ae8-a61f-f4243097dd6c';
    console.log("=== CHECKING robot_commands ===");
    const { data: cmds, error: cmdErr } = await supabase.from('robot_commands').select('command_id, status, result, created_at').order('created_at', { ascending: false }).limit(200);
    if (cmds) {
        const match = cmds.find(c => JSON.stringify(c).includes(testId));
        console.log(match ? { id: match.command_id, status: match.status } : "NOT FOUND IN 200 COMMANDS");
    }
}
run();
