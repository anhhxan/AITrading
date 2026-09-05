const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmds } = await supabase.from('robot_commands')
        .select('command_id, created_at, processing_started_at, processed_at, status')
        .eq('robot_id', 'e0d00614-dfcc-4948-b840-340bfa0f8707')
        .order('created_at', { ascending: false })
        .limit(20);
    
    console.log(JSON.stringify(cmds, null, 2));
}
run();
