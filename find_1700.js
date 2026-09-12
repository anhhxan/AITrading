const {Client} = require('pg');
const fs = require('fs');
const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
const client = new Client({connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl:{rejectUnauthorized:false}});
client.connect().then(async ()=>{
  const res = await client.query("SELECT created_at, result FROM robot_commands WHERE command_type='TV_SIGNAL' ORDER BY created_at DESC LIMIT 50");
  res.rows.forEach(r => {
     const date = new Date(r.created_at);
     console.log(`[${date.toISOString()}] (Local: ${date.toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})}) barTimestamp: ${r.result.barTimestamp}`);
  });
  client.end();
})
