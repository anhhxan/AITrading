const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: robots } = await supabase.from('robots').select('id, name').eq('timeframe', '3h');
  if (robots && robots.length > 0) {
    const { data: cmds } = await supabase
      .from('robot_commands')
      .select('created_at, result')
      .eq('robot_id', robots[0].id)
      .gte('created_at', '2026-09-02T11:55:00Z')
      .lte('created_at', '2026-09-02T12:05:00Z');
    console.log(JSON.stringify(cmds, null, 2));
  } else {
    console.log("No 3h robot found");
  }
}
check();
