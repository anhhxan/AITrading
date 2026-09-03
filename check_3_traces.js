const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: traces } = await supabase
    .from('signal_trace_events')
    .select('adapter_status, strategy_result, strategy_status, created_at, updated_at')
    .eq('robot_id', '7e95b9b5-e113-4d61-92a6-26c9979e7ebc')
    .order('bar_timestamp', { ascending: false })
    .limit(3);
    
  console.log(traces);
}
check();
