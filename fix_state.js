const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  await supabase.from('robots').update({ current_state: 'WAIT_SIGNAL', current_state_updated_at: new Date().toISOString() }).eq('id', 'e0d00614-dfcc-4948-b840-340bfa0f8707');
  console.log('Fixed stuck state in DB');
}
fix();
