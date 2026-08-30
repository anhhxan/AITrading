const { Client } = require('pg');
const fs = require('fs');

async function reload() {
    const envContent = fs.readFileSync('.env.migration', 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim() : null;
    };
    
    const dbPass = getEnv('SUPABASE_TARGET_DB_PASSWORD');
    const projectRef = getEnv('SUPABASE_TARGET_PROJECT_REF');
    const dbUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        console.log('PostgREST schema cache reloaded.');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
reload();
