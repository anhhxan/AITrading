const fs = require('fs');

async function fetchOpenApi() {
    const env = fs.readFileSync('.env.migration', 'utf8');
    const getEnv = k => env.match(new RegExp('^'+k+'=(.*)$','m'))[1].trim();
    
    const url = 'https://gixfypcwpeepjiqwlndk.supabase.co/rest/v1/?apikey=' + getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const res = await fetch(url);
    const data = await res.json();
    fs.writeFileSync('source_openapi.json', JSON.stringify(data, null, 2));
    console.log('Saved source OpenAPI spec.');
}
fetchOpenApi();
