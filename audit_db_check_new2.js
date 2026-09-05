const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmd } = await supabase.from('robot_commands').select('*').eq('command_id', '7e7713b4-5ca0-4a95-a9e6-50cf442849af').single();
    console.log(cmd);
}
run();
