const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data } = await supabase.from('robots').select('current_state').eq('id', '1ba05b33-0b3c-4838-9cbb-dfe8161895d9').single();
    console.log("Current state:", data?.current_state);
}
run();
