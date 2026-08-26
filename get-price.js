require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: events } = await supabase.from('core_events')
        .select('payload')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .eq('event_type', 'PRICE_HEARTBEAT_EVENT')
        .order('created_at', { ascending: false })
        .limit(1);
    console.log(events[0]?.payload?.price);
}
check();
