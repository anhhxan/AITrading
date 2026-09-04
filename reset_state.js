const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { error } = await supabase.from('robots').update({ current_state: 'WAIT_SIGNAL' }).in('current_state', ['WAIT_CANDLE_B_CONFIRMATION', 'READY_TO_ENTER']);
    if (error) console.error("Error:", error);
    else console.log("Successfully reset stuck states.");
}
run();
