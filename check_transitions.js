const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: evs } = await supabase
    .from('core_events')
    .select('robot_id, payload, created_at')
    .eq('event_type', 'STATE_TRANSITION_EVENT')
    .gte('created_at', '2026-09-02T16:00:00Z')
    .order('created_at', { ascending: false });
    
  console.log(`Transitions:`, evs.length);
  for (const e of evs) {
    console.log(`- ${e.created_at}: ${e.robot_id} -> ${e.payload.newState} (${e.payload.reason})`);
  }
}
check();
