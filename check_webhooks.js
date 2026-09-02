const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('robot_commands')
    .select('result')
    .eq('robot_id', 'e0d00614-dfcc-4948-b840-340bfa0f8707')
    .eq('status', 'SUCCEEDED')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (error) console.error(error);
  else {
    console.log(JSON.stringify(data[0].result, null, 2).substring(0, 500));
  }
}
check();
