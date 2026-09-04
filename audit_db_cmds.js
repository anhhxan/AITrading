const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cmds } = await supabase.from('robot_commands').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(cmds, null, 2));
}
run();
