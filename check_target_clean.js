const {Client} = require('pg'); 
const fs = require('fs'); 
const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim(); 
const client = new Client({connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', ssl:{rejectUnauthorized:false}}); 
client.connect().then(async ()=>{
  const tables = ['robots', 'robot_configs', 'active_setups', 'active_positions', 'active_orders', 'execution_intents', 'trade_history', 'robot_commands', 'core_events'];
  for (const t of tables) {
    const res = await client.query(`SELECT count(*) FROM ${t}`);
    console.log(`${t} = ${res.rows[0].count}`);
  }
  client.end();
})
