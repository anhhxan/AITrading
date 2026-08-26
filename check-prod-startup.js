require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const afterTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // last 5 minutes
    console.log("Checking events after:", afterTime);
    
    const { data: events } = await supabase
        .from('core_events')
        .select('event_type, timestamp, payload, event_sequence, created_at')
        .in('event_type', ['REALTIME_PRICE_FEED_CONNECTING', 'PRICE_HEARTBEAT_EVENT'])
        .gte('created_at', afterTime)
        .order('created_at', { ascending: false })
        .limit(10);
        
    console.log(events);
}
check();
