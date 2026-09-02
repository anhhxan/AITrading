const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cmds } = await supabase
    .from('robot_commands')
    .select('created_at, result')
    .eq('robot_id', '1ba05b33-0b3c-4838-9cbb-dfe8161895d9')
    .gte('created_at', '2026-09-02T12:00:00Z')
    .lte('created_at', '2026-09-02T13:05:00Z')
    .order('created_at', { ascending: true });
    
  for (const c of cmds) {
    const res = c.result;
    console.log(`Webhook at ${c.created_at}`);
    console.log(`  Candle (barTimestamp: ${res.barTimestamp})`);
    console.log(`  O: ${res.open}, H: ${res.high}, L: ${res.low}, C: ${res.close}`);
    console.log(`  B3: ${res.plots.B3}, B4: ${res.plots.B4}, B5: ${res.plots.B5}`);
  }
}
check();
