const { Client } = require('pg');
const fs = require('fs');

async function runMig() {
    const env = fs.readFileSync('.env.migration','utf8');
    const dbPass = env.match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
    const dbRef = env.match(/^SUPABASE_TARGET_PROJECT_REF=(.*)$/m)[1].trim();
    const client = new Client({ 
        connectionString: 'postgresql://postgres.'+dbRef+':' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', 
        ssl: {rejectUnauthorized: false} 
    });
    
    await client.connect();
    
    const sql = fs.readFileSync('supabase/migrations/20260829000000_sync_codebase_schema.sql', 'utf8');
    await client.query(sql);
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    
    console.log('Migrated and reloaded!');
    await client.end();
}
runMig().catch(console.error);
