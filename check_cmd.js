const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cmd } = await supabase
    .from('robot_commands')
    .select('*')
    .eq('command_id', '96489a97-3506-4561-a727-f072b5a5a991') // The latest one for 1h robot
    .single();
  console.log(cmd.result);
}
check();
