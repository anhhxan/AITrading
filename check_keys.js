const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' }); // This contains the SOURCE credentials in the PRE_MIGRATION version, wait...
const getEnv = (key) => {
    const fs = require('fs');
    const env = fs.readFileSync('.env.migration','utf8');
    const match = env.match(new RegExp('^'+key+'=(.*)$','m'));
    return match ? match[1].trim() : null;
};
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

async function check() {
    const { data } = await supabase.from('robots').select('*').limit(1);
    if(data && data.length > 0) {
        console.log(Object.keys(data[0]));
    }
}
check();
