const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: robots } = await supabase.from('robots').select('id, name').eq('status', 'RUNNING');
  
  for (const r of robots) {
    if (r.name !== 'paper 3h') continue;
    const { data: cmds } = await supabase
      .from('robot_commands')
      .select('created_at, result')
      .eq('robot_id', r.id)
      .gte('created_at', '2026-09-02T16:00:00Z')
      .order('created_at', { ascending: true });
      
    console.log(`--- ${r.name} ---`);
    for (const c of cmds) {
       const res = c.result;
       console.log(`${c.created_at} | O: ${res.open}, H: ${res.high}, L: ${res.low}, C: ${res.close} | B1: ${res.plots.B1.toFixed(2)}, B2: ${res.plots.B2.toFixed(2)}, B3: ${res.plots.B3.toFixed(2)}, B4: ${res.plots.B4.toFixed(2)}, B5: ${res.plots.B5.toFixed(2)}`);
    }
  }
}
check();
