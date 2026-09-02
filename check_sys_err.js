const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: evs } = await supabase
    .from('core_events')
    .select('event_type, payload, created_at')
    .eq('event_type', 'SYSTEM_ERROR')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(evs);
}
check();
