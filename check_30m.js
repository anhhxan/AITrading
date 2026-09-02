const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: robots, error: err1 } = await supabase.from('robots').select('id, name, timeframe').eq('timeframe', '30m');
  console.log("Robots:", robots);
  
  if (robots && robots.length > 0) {
    for (const r of robots) {
      const { data: cmds, error: err2 } = await supabase
        .from('robot_commands')
        .select('created_at, status, result, payload')
        .eq('robot_id', r.id)
        .order('created_at', { ascending: false })
        .limit(3);
      console.log(`Commands for ${r.id}:`, cmds.map(c => ({
         time: c.created_at,
         status: c.status,
         barTimestamp: c.result && c.result.barTimestamp
      })));
      
      const { data: evs } = await supabase
        .from('core_events')
        .select('created_at, event_type, payload')
        .eq('robot_id', r.id)
        .order('created_at', { ascending: false })
        .limit(3);
      console.log(`Events for ${r.id}:`, evs.map(e => ({ type: e.event_type, time: e.created_at })));
    }
  }
}
check();
