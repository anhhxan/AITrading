const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const traceId = 'tv_37100a56e789891d';
    console.log("=== CHECKING core_events for correlation_id:", traceId, "===");
    const { data: evts } = await supabase.from('core_events').select('event_type, payload').eq('correlation_id', traceId).order('created_at', { ascending: false });
    if (evts) {
        console.log(evts.map(e => e.event_type));
    }
}
run();
