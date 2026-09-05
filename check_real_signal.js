const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmd } = await supabase.from('robot_commands')
        .select('result')
        .eq('command_id', 'ea43259d-5964-419e-a059-933a25336090')
        .single();
    
    console.log(JSON.stringify(cmd.result));
}
run();
