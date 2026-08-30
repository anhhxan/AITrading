const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    // Read from .env.migration
    const envContent = fs.readFileSync('.env.migration', 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim() : null;
    };
    
    const dbPass = getEnv('SUPABASE_TARGET_DB_PASSWORD');
    const projectRef = getEnv('SUPABASE_TARGET_PROJECT_REF');
    const dbUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    
    console.log(`Connecting to Target DB via Pooler`);
    
    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        console.log('Connected.');
        
        const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
        let files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
            
        // Resume from migration 10
        const resumeFile = '20260823000001_fix_execution_rls.sql';
        const resumeIndex = files.indexOf(resumeFile);
        if (resumeIndex !== -1) {
            files = files.slice(resumeIndex);
        }
            
        let passed = 0;
        let failed = 0;
        
        for (const file of files) {
            console.log(`Executing migration: ${file}`);
            let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            
            // Strip UTF-8 BOM if present
            if (sql.charCodeAt(0) === 0xFEFF) {
                sql = sql.slice(1);
            }
            
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('COMMIT');
                passed++;
                console.log(` - Passed`);
            } catch (err) {
                await client.query('ROLLBACK');
                failed++;
                console.error(`\nMigration Failed: ${file}`);
                console.error(`Error: ${err.message}`);
                console.error(`PostgreSQL error code: ${err.code}`);
                break; // STOP ON FIRST ERROR
            }
        }
        
        console.log(`\nResults: ${passed} passed, ${failed} failed.`);
        
    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await client.end();
    }
}

migrate();
