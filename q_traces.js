const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: traces } = await supabase.from('signal_trace_events')
        .select('created_at, adapter_status, strategy_status, strategy_result, tv_status')
        .gte('created_at', '2026-09-04T02:40:00.000Z')
        .order('created_at', { ascending: false });
    
    console.log(traces);
}
run();
