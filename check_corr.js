const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cmds } = await supabase
    .from('robot_commands')
    .select('command_id, correlation_id')
    .eq('robot_id', '7e95b9b5-e113-4d61-92a6-26c9979e7ebc')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(cmds);
}
check();
