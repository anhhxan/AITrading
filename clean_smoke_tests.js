const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('robots').update({ status: 'ARCHIVED' }).like('name', '%Smoke Test%');
  console.log(error || 'Cleaned up smoke tests');
}
check();
