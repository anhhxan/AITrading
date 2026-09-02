const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('core_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
    
  if (error) console.error(error);
  else {
    console.log(`Found ${data.length} events`);
    for (const row of data.reverse()) {
      if (row.event_type !== 'REALTIME_PRICE_EVENT' && row.event_type !== 'TV_WEBHOOK_RAW') {
        console.log(`[${row.created_at}] ${row.event_type} - ${JSON.stringify(row.payload).substring(0, 200)}`);
      }
    }
  }
}
check();
