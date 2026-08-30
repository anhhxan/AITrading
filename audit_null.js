const { Client } = require('pg');
const fs = require('fs');

async function audit() {
    const envMigContent = fs.readFileSync('.env.migration', 'utf8');
    const dbPass = envMigContent.match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
    const dbRef = envMigContent.match(/^SUPABASE_TARGET_PROJECT_REF=(.*)$/m)[1].trim();
    const dbUrl = `postgresql://postgres.${dbRef}:${encodeURIComponent(dbPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const cols = await client.query(`
        SELECT table_name, column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name IN ('robots', 'robot_configs')
    `);
    
    console.log(JSON.stringify(cols.rows.filter(r => r.table_name === 'robots'), null, 2));
    await client.end();
}
audit().catch(console.error);
