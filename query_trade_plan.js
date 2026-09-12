const {Client} = require('pg');
const fs = require('fs');
const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
const client = new Client({connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl:{rejectUnauthorized:false}});
client.connect().then(async ()=>{
  const res = await client.query("SELECT payload FROM core_events WHERE event_type='TRADE_PLAN_EVENT' ORDER BY created_at DESC LIMIT 2");
  console.log(JSON.stringify(res.rows.map(r => r.payload), null, 2));
  client.end();
})
