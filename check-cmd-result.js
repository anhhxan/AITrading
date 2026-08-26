require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: cmd } = await supabase.from('robot_commands')
        .select('result')
        .eq('command_id', 'a6189260-d90f-476a-a6f1-6f8b0978cf8c');
    console.log(JSON.stringify(cmd[0]?.result, null, 2));
}
check();
