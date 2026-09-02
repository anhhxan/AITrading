const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: robots } = await supabase.from('robots').select('name, lifecycle_status, is_active').eq('lifecycle_status', 'RUNNING');
  console.log(`Found ${robots.length} RUNNING robots`);
  for (const r of robots) {
    console.log(`- ${r.name}`);
  }
}
check();
