const { Client } = require('pg');
const fs = require('fs');

async function audit() {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim() : null;
    };
    
    // I need SUPABASE_TARGET_DB_PASSWORD from .env.migration since it's not in .env.local
    const envMigContent = fs.readFileSync('.env.migration', 'utf8');
    const dbPass = envMigContent.match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
    const dbRef = envMigContent.match(/^SUPABASE_TARGET_PROJECT_REF=(.*)$/m)[1].trim();
    const dbUrl = `postgresql://postgres.${dbRef}:${encodeURIComponent(dbPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // D1: Check columns of robots and robot_configs
    const cols = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name IN ('robots', 'robot_configs')
    `);
    
    // D2: Check RLS Policies
    const rls = await client.query(`
        SELECT tablename, policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename IN ('robots', 'robot_configs', 'active_setups', 'active_positions', 'active_orders', 'execution_intents', 'trade_history', 'robot_commands', 'core_events')
    `);

    // Write to a JSON file
    fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\target_audit.json', JSON.stringify({
        columns: cols.rows,
        policies: rls.rows
    }, null, 2));

    console.log('Audit generated.');
    await client.end();
}

audit().catch(console.error);
