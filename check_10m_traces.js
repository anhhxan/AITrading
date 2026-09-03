const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: traces } = await supabase
    .from('signal_trace_events')
    .select('bar_timestamp, strategy_result, diagnostics')
    .eq('robot_id', 'e0d00614-dfcc-4948-b840-340bfa0f8707')
    .gte('bar_timestamp', 1788360000000 - 86400000)
    .order('bar_timestamp', { ascending: false })
    .limit(5);
    
  console.log(traces);
}
check();
