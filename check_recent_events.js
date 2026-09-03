const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: evs } = await supabase
    .from('core_events')
    .select('event_type, created_at, robot_id, payload')
    .in('event_type', ['STATE_TRANSITION_EVENT', 'SYSTEM_ERROR'])
    .gte('created_at', '2026-09-03T02:00:00Z')
    .order('created_at', { ascending: false });
    
  console.log(`Events:`, evs.length);
  for (const e of evs) {
    console.log(`- ${e.created_at}: ${e.robot_id} -> ${e.event_type} - ${JSON.stringify(e.payload)}`);
  }
}
check();
