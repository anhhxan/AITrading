const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cmds } = await supabase
    .from('robot_commands')
    .select('created_at, result')
    .eq('robot_id', '7e95b9b5-e113-4d61-92a6-26c9979e7ebc')
    .gte('created_at', '2026-09-03T02:00:00Z')
    .order('created_at', { ascending: false })
    .limit(3);
    
  for (const c of cmds) {
     const r = c.result;
     console.log(`${c.created_at} | O:${r.open} H:${r.high} L:${r.low} C:${r.close} | B1:${r.plots.B1.toFixed(2)} B2:${r.plots.B2.toFixed(2)} B3:${r.plots.B3.toFixed(2)} B4:${r.plots.B4.toFixed(2)} B5:${r.plots.B5.toFixed(2)}`);
  }
}
check();
