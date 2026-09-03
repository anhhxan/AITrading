const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: cols, error } = await supabase.rpc('get_table_info', { table_name: 'signal_trace_events' });
  console.log(cols || error);
}
check();
