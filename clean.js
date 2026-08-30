const { Client } = require('pg');
const fs = require('fs');
async function clean() {
    const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
    const client = new Client({ connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl: {rejectUnauthorized: false} });
    await client.connect();
    await client.query("DELETE FROM core_events WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM robot_configs WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM active_positions WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM active_setups WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM robot_commands WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM robot_configs WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM robot_commands WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM trade_history WHERE robot_id = '20261111-0000-4000-a000-000000000001'");
    await client.query("DELETE FROM robots WHERE id = '20261111-0000-4000-a000-000000000001'");
    await client.end();
}
clean().catch(console.error);
