
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/A/Tradding AI/trading-platform/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = '33f9c37d-64ef-4a01-8aa3-05a1d897c193';
async function run() {
    const { data } = await supabase.from('robot_commands').select('status, result').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(data, null, 2));
}
run();
