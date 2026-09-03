const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cmds } = await supabase
    .from('robot_commands')
    .select('robot_id, created_at, status')
    .gte('created_at', '2026-09-02T16:00:00Z')
    .order('created_at', { ascending: false });
    
  console.log(`Total commands since 16:00 UTC: ${cmds.length}`);
  if (cmds.length > 0) {
    console.log(`Most recent:`, cmds[0]);
    console.log(`Oldest:`, cmds[cmds.length - 1]);
  }
}
check();
