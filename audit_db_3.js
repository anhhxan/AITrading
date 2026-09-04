const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const traceId = 'cf_req_eb1f862337c6';
    const testId = '114ac833-cdf7-4ae8-a61f-f4243097dd6c';

    console.log("=== CHECKING signal_trace_events ===");
    const { data: traces } = await supabase.from('signal_trace_events').select('*').order('created_at', { ascending: false }).limit(50);
    if (traces) {
        console.log(traces.filter(t => JSON.stringify(t).includes(traceId) || JSON.stringify(t).includes(testId)));
    }
}
run();
