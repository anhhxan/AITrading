const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: cols, error } = await supabase.rpc('get_robot_columns_test', {}); // Just to force an error to see if we can get schema, or we can just fetch 1 row
    const { data: robots } = await supabase.from('robots').select('*').limit(1);
    console.log(Object.keys(robots[0]));
}
run();
