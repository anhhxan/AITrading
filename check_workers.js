const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: robots } = await supabase.from('robots').select('id, name, worker_id, last_heartbeat_at');
  console.log("Robots:", robots);
}
check();
