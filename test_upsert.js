const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const payload = {
      robot_id: '7e95b9b5-e113-4d61-92a6-26c9979e7ebc',
      bar_timestamp: 1788426000000,
      strategy_status: 'GREEN',
      strategy_result: 'SHORT',
      candle_trace_id: '1m_1788426000000',
      timeframe: '1m',
      time_utc: new Date(1788426000000).toISOString()
  };

  const { data, error } = await supabase
      .from('signal_trace_events')
      .upsert(payload, { 
          onConflict: 'robot_id, bar_timestamp',
          ignoreDuplicates: false 
      })
      .select();
      
  console.log("Error:", error);
  console.log("Data:", data);
}
check();
