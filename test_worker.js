const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('core_events').select('*').eq('event_type', 'WORKER_HEARTBEAT_EVENT').order('created_at', { ascending: false }).limit(3);
  console.log(data);
}
check();
