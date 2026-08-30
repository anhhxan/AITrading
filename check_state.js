const { Client } = require('pg');
const fs = require('fs');
async function check() {
    const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
    const client = new Client({ connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl: {rejectUnauthorized: false} });
    await client.connect();
    const r = await client.query("SELECT current_state FROM robots WHERE id = '20261111-0000-4000-a000-000000000001'");
    console.log(r.rows);
    await client.end();
}
check().catch(console.error);
