const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const robotId = '7e95b9b5-e113-4d61-92a6-26c9979e7ebc';
    const { data: events } = await supabase.from('core_events')
        .select('event_type, created_at, payload')
        .eq('robot_id', robotId)
        .order('created_at', { ascending: false })
        .limit(10);
        
    events?.forEach(e => console.log(`${e.event_type} at ${e.created_at} | ${JSON.stringify(e.payload).substring(0, 100)}`));
}
run();
