require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: cmd } = await supabase
        .from('robot_commands')
        .select('*')
        .eq('command_id', 'a6ecfaac-bf48-4f45-a0d9-eb0a60706af4');
    console.log(cmd);
}
check();
