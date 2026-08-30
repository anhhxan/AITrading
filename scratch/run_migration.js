require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
    // get NEXT_PUBLIC_SUPABASE_URL and extract host, db, etc?
    // Wait, .env.local usually has DATABASE_URL for direct connection.
    if (!process.env.DATABASE_URL) {
        console.error('No DATABASE_URL found. Cannot run migration directly.');
        return;
    }
    
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    const sql = fs.readFileSync('supabase/migrations/20260828000001_phase37_live_data.sql', 'utf8');
    try {
        await client.query(sql);
        console.log('Migration SUCCESS');
    } catch (e) {
        console.error('Migration ERROR:', e);
    } finally {
        await client.end();
    }
}
migrate();
