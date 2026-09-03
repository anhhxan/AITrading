const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase
    .from('robot_configs')
    .select('*')
    .eq('robot_id', '7e95b9b5-e113-4d61-92a6-26c9979e7ebc')
    .eq('status', 'ACTIVE');
  console.log("Config for 1h robot:", data);
}
check();
