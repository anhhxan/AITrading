const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase
    .from('robot_configs')
    .select('*')
    .eq('robot_id', 'e0d00614-dfcc-4948-b840-340bfa0f8707')
    .eq('status', 'ACTIVE');
  console.log("Config for 10m robot:", data);
}
check();
