import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://gixfypcwpeepjiqwlndk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpeGZ5cGN3cGVlcGppcXdsbmRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4NTQwNCwiZXhwIjoyMTAxNjYxNDA0fQ.qGPyuhkiJc0jCzoJ9F-Y1i4KWPcV6W9ON3D18qFiWrg');
const robotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';

async function monitor() {
  const tsStart = new Date().getTime();
  let latestTs = 0;
  console.log('Waiting for new trace after:', new Date().toISOString());
  while (true) {
    const { data: traces } = await supabase.from('signal_trace_events').select('*').eq('robot_id', robotId).order('bar_timestamp', { ascending: false }).limit(1);
    if (traces && traces.length > 0) {
      const trace = traces[0];
      const traceTs = Number(trace.bar_timestamp);
      if (traceTs > latestTs && traceTs > tsStart - 60000) {
        latestTs = traceTs;
        console.log('--- NEW CANDLE DETECTED ---');
        console.log('Timestamp:', new Date(traceTs).toISOString());
        console.log('CF:', trace.cf_status);
        console.log('Vercel:', trace.vercel_status);
        console.log('DB:', trace.db_status);
        console.log('Poller:', trace.poller_status);
        console.log('Adapter:', trace.adapter_status);
        console.log('Strategy:', trace.strategy_status);
        if (trace.poller_status === 'GREEN' || trace.poller_status === 'UNKNOWN') {
           // We might need to wait for worker
           await new Promise(r => setTimeout(r, 5000));
           const { data: traces2 } = await supabase.from('signal_trace_events').select('*').eq('robot_id', robotId).order('bar_timestamp', { ascending: false }).limit(1);
           const t2 = traces2[0];
           console.log('After worker processed:');
           console.log('Poller:', t2.poller_status);
           console.log('Adapter:', t2.adapter_status);
           console.log('Strategy:', t2.strategy_status);
           if (t2.poller_status === 'GREEN' && t2.adapter_status === 'GREEN' && t2.strategy_status?.startsWith('GREEN')) {
               console.log('SUCCESS: Full GREEN trace end-to-end!');
               break;
           }
        }
      }
    }
    await new Promise(r => setTimeout(r, 10000));
  }
}
monitor();

