require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: events } = await supabase
        .from('core_events')
        .select('event_type, timestamp, payload')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .neq('event_type', 'PRICE_HEARTBEAT_EVENT')
        .order('timestamp', { ascending: false })
        .limit(20);
    
    if (events) {
        events.forEach(e => console.log(`[${new Date(e.timestamp).toISOString()}] ${e.event_type}`));
    }
}
check();
