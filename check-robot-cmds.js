require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: cmds } = await supabase.from('robot_commands')
        .select('command_id, status, created_at, result')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(cmds.map(c => `${c.status} | ${c.command_id} | ${c.created_at} | B4=${c.result.bands?.B4}`));
}
check();
