require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { data, error } = await supabase.from('robots').select('id, current_state').eq('id', '6e7a371d-dc97-4f07-b804-ee89518a898b').is('deleted_at', null).single();
    console.log(error);
}
run();
