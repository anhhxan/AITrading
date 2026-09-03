const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: robots } = await supabase.from('robots').select('current_state, current_state_updated_at').eq('id', 'f939ddb7-51de-4992-ae08-cf32b673760b');
  console.log(robots);
}
check();
