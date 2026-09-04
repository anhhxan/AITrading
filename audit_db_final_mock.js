const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '4484cd6f-ed27-495f-98b0-b1d364367cd0';
    const { data: cmd } = await supabase.from('robot_commands').select('*').contains('result', { testId }).single();
    console.log(cmd);
}
run();
