const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: configs } = await supabase.from('robot_configs').select('robot_id, status').eq('status', 'ACTIVE');
  console.log(configs);
}
check();
