const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmd } = await supabase.from('robot_commands')
        .select('result')
        .eq('command_id', 'bc0a229e-8e7a-4643-abc9-738b0acfaeea')
        .single();
    
    console.log("Keys in result:", Object.keys(cmd.result));
    if (cmd.result.execution) console.log("Execution:", cmd.result.execution);
    if (cmd.result.error) console.log("Error:", cmd.result.error);
}
run();
