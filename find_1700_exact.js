const {Client} = require('pg');
const fs = require('fs');
const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
const client = new Client({connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl:{rejectUnauthorized:false}});
client.connect().then(async ()=>{
  const res = await client.query("SELECT created_at, result FROM robot_commands WHERE command_type='TV_SIGNAL'");
  res.rows.forEach(r => {
     const date = new Date(r.created_at);
     const localHour = date.getHours() + (date.getTimezoneOffset() / -60) + 7; // rough GMT+7
     if (localHour >= 16.9 && localHour <= 17.5) {
       console.log(`[${date.toISOString()}] (Local: ${date.toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})}) barTimestamp: ${r.result.barTimestamp}`);
     }
  });
  client.end();
})
