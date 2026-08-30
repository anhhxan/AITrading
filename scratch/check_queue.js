
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/A/Tradding AI/trading-platform/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { count } = await supabase.from('robot_commands').select('*', { count: 'exact', head: true }).eq('status', 'RECEIVED');
    console.log('RECEIVED count:', count);
}
run();
