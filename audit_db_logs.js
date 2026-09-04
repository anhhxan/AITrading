const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: logs } = await supabase.from('robot_commands').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(logs.map(l => ({ id: l.command_id, status: l.status, result: l.result?.execution, processing_started_at: l.processing_started_at, processed_at: l.processed_at })));
}
run();
