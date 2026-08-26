require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: events } = await supabase
        .from('core_events')
        .select('event_type, timestamp, robot_id')
        .eq('event_type', 'REALTIME_PRICE_FEED_CONNECTING')
        .order('timestamp', { ascending: false })
        .limit(3);
    console.log(events);
}
check();
