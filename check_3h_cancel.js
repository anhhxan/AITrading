const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: evs } = await supabase
    .from('core_events')
    .select('payload, created_at')
    .eq('event_type', 'STATE_TRANSITION_EVENT')
    .eq('robot_id', 'f939ddb7-51de-4992-ae08-cf32b673760b')
    .gte('created_at', '2026-09-02T16:00:00Z');
  console.log(evs);
}
check();
