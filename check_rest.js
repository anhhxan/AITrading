const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.migration', 'utf8');
const getEnv = k => env.match(new RegExp('^'+k+'=(.*)$','m'))[1].trim();
const supabase = createClient('https://gixfypcwpeepjiqwlndk.supabase.co', getEnv('SUPABASE_SERVICE_ROLE_KEY'));

async function check() {
    const { data, error } = await supabase.from('information_schema.columns').select('*').eq('table_name', 'robots');
    console.log("Result:", data, error);
}
check();
