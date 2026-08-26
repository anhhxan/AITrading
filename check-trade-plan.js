require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const afterTime = new Date(Date.now() - 60 * 60000).toISOString();
    const { data: events } = await supabase.from('core_events')
        .select('payload')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .eq('event_type', 'TRADE_PLAN_EVENT')
        .gte('created_at', afterTime);
    console.log(events[0]?.payload);
}
check();
