const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: evs } = await supabase
    .from('core_events')
    .select('event_type, payload')
    .eq('robot_id', '1ba05b33-0b3c-4838-9cbb-dfe8161895d9')
    .limit(10);
  console.log(evs);
}
check();
