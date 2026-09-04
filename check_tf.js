const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRobots() {
    const { data } = await supabase.from('robots').select('id, timeframe').in('timeframe', ['30m', '1h']).eq('status', 'RUNNING');
    console.log(data);
}
checkRobots();
