const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const correlationId = 'tv_6369e32378cab656';
    console.log("=== CHECKING core_events ===");
    const { data: evts } = await supabase.from('core_events').select('event_type, created_at, payload').eq('correlation_id', correlationId).order('created_at', { ascending: true });
    console.log(evts);
}
run();
