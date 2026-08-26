require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: cmds } = await supabase.from('robot_commands')
        .select('command_id, status, created_at')
        .eq('status', 'RECEIVED')
        .order('created_at', { ascending: true })
        .limit(5);
    console.log(cmds);
}
check();
