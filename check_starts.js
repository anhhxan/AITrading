const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStarts() {
    const { data } = await supabase.from('core_events').select('timestamp, payload').eq('event_type', 'PAPER_WORKER_STARTING').order('timestamp', { ascending: false }).limit(5);
    console.log(data);
}
checkStarts();
