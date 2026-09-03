const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: logs } = await supabase
    .from('robot_logs')
    .select('*')
    .eq('robot_id', '7e95b9b5-e113-4d61-92a6-26c9979e7ebc')
    .eq('event_type', 'CANDLE_GAP_DETECTED')
    .gte('created_at', '2026-09-03T09:59:00Z')
    .lte('created_at', '2026-09-03T10:02:00Z');
  console.log(logs);
}
check();
