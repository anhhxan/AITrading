const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 1. Get exact worker start times using REALTIME_PRICE_FEED_STARTED
    const { data: starts } = await supabase.from('core_events')
        .select('timestamp, robot_id')
        .eq('event_type', 'REALTIME_PRICE_FEED_STARTED')
        .gte('timestamp', '2026-09-04T00:00:00.000Z')
        .order('timestamp', { ascending: false });
    
    console.log('--- WORKER RESTARTS (REALTIME_PRICE_FEED_STARTED) ---');
    console.log(starts);

    // 2. Check robot_commands during the period 09:40 to 11:20 local time
    const { data: commands } = await supabase.from('robot_commands')
        .select('created_at, status')
        .gte('created_at', '2026-09-04T02:40:00.000Z')
        .lte('created_at', '2026-09-04T04:20:00.000Z')
        .order('created_at', { ascending: false });
    
    console.log('\n--- COMMANDS DURING DEPLOY/GAP ---');
    console.log(commands);

    // 3. Current heartbeat status
    const { data: hb } = await supabase.from('robots').select('id, last_heartbeat_at').eq('status', 'RUNNING');
    console.log('\n--- CURRENT HEARTBEATS ---');
    console.log(hb);
}
run();
