const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cmds } = await supabase
    .from('robot_commands')
    .select('created_at, result')
    .eq('robot_id', '1ba05b33-0b3c-4838-9cbb-dfe8161895d9')
    .gte('created_at', '2026-09-02T12:00:00Z')
    .lte('created_at', '2026-09-02T12:05:00Z');
    
  if (cmds && cmds.length > 0) {
    const res = cmds[0].result.previousPayload;
    console.log(`Open: ${res.open}, Close: ${res.close}, Low: ${res.low}, B4: ${res.plots.B4}`);
  }
}
check();
