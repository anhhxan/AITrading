const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: traces } = await supabase
    .from('signal_trace_events')
    .select('robot_id, bar_timestamp, strategy_result, adapter_status, diagnostics')
    .gte('bar_timestamp', 1788397200000)
    .order('bar_timestamp', { ascending: false });
    
  const gaps = traces.filter(t => t.diagnostics && t.diagnostics.event === 'CANDLE_GAP_DETECTED');
  console.log(gaps);
}
check();
