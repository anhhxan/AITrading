const {Client} = require('pg'); 
const fs = require('fs'); 
const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim(); 
const client = new Client({connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl:{rejectUnauthorized:false}}); 
client.connect().then(()=>client.query(`SELECT * FROM trade_history`)).then(r=>{console.log(r.rows); client.end();})
