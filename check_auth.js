const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.migration' });

async function checkAuth() {
    // Source
    const sourceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Target
    const dbPass = process.env.SUPABASE_TARGET_DB_PASSWORD;
    const projectRef = process.env.SUPABASE_TARGET_PROJECT_REF;
    const dbUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        
        // Check FK on robots using pg_constraint
        const fkRes = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'robots'
        `);
        
        console.log("Robots pg_constraint:");
        console.log(fkRes.rows);
        
        // Fetch Source users
        const { data: users, error } = await sourceSupabase.auth.admin.listUsers();
        if (error) throw error;
        
        console.log(`\nSource Auth Users (${users.users.length}):`);
        users.users.forEach(u => console.log(`- ${u.id} (${u.email})`));
        
        // Check Target users
        const targetUsers = await client.query(`SELECT id, email FROM auth.users`);
        console.log(`\nTarget Auth Users (${targetUsers.rowCount}):`);
        targetUsers.rows.forEach(u => console.log(`- ${u.id} (${u.email})`));
        
        // Check robots.user_id from Source
        const { data: robots } = await sourceSupabase.from('robots').select('user_id');
        const robotUserIds = new Set(robots.map(r => r.user_id));
        console.log(`\nUnique user_ids in Source robots:`, Array.from(robotUserIds));
        
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
checkAuth();
