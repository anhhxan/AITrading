require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log("Checking for any recent events...");
    const { data: events } = await supabase
        .from('core_events')
        .select('event_type, timestamp, payload')
        .order('timestamp', { ascending: false })
        .limit(5);

    if (events) {
        events.forEach(e => {
            console.log(e.event_type, new Date(e.timestamp).toISOString());
            if (e.event_type === 'TEST_SIGNAL' || e.event_type === 'STRATEGY_SIGNAL_EVENT' || e.event_type === 'TRADE_PLAN_EVENT' || e.event_type === 'POSITION_OPENED_EVENT' || e.event_type === 'STATE_TRANSITION_EVENT') {
                console.log(e.payload);
            }
        });
    }
}
check();
