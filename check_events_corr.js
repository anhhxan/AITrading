const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data } = await supabase.from('core_events').select('event_type, created_at, correlation_id').in('correlation_id', ['8f53a0ad-18bd-4296-ac20-890f3e9017d6', 'tv_f6a74338e1e0a877']).order('created_at', {ascending: true});
    console.log(data);
}
run();
