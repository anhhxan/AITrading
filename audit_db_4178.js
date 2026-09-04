const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmd } = await supabase.from('robot_commands').select('*').eq('command_id', '4178d5e2-2027-4b32-ac2e-526e9b198fb6').single();
    console.log(cmd);
}
run();
