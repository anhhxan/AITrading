const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const traceId = 'tv_6369e32378cab656';
    const { data: cmd } = await supabase.from('robot_commands').select('status, result').eq('correlation_id', traceId);
    console.log(cmd);
}
run();
