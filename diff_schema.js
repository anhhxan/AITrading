const { Client } = require('pg');
const fs = require('fs');

async function extractSchema(client) {
    const schema = {
        columns: {},
        constraints: {},
        indexes: {},
        rls: {},
        functions: {},
        triggers: {}
    };

    // Columns
    const cols = await client.query(`
        SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
    `);
    cols.rows.forEach(r => {
        if (!schema.columns[r.table_name]) schema.columns[r.table_name] = {};
        schema.columns[r.table_name][r.column_name] = r;
    });

    // Constraints (Primary, Foreign, Unique, Check)
    const constraints = await client.query(`
        SELECT 
            t.relname as table_name, 
            c.conname as constraint_name, 
            c.contype as constraint_type,
            pg_get_constraintdef(c.oid) as definition
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
    `);
    constraints.rows.forEach(r => {
        if (!schema.constraints[r.table_name]) schema.constraints[r.table_name] = {};
        schema.constraints[r.table_name][r.constraint_name] = r;
    });

    // Indexes
    const indexes = await client.query(`
        SELECT 
            tablename as table_name, 
            indexname as index_name, 
            indexdef as definition
        FROM pg_indexes
        WHERE schemaname = 'public'
    `);
    indexes.rows.forEach(r => {
        if (!schema.indexes[r.table_name]) schema.indexes[r.table_name] = {};
        schema.indexes[r.table_name][r.index_name] = r;
    });

    // RLS
    const rls = await client.query(`
        SELECT tablename, policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
    `);
    rls.rows.forEach(r => {
        if (!schema.rls[r.tablename]) schema.rls[r.tablename] = {};
        schema.rls[r.tablename][r.policyname] = r;
    });
    
    // RLS enabled tables
    const rlsEnabled = await client.query(`
        SELECT relname FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid 
        WHERE n.nspname = 'public' AND c.relrowsecurity = true
    `);
    schema.rlsEnabled = rlsEnabled.rows.map(r => r.relname);

    return schema;
}

async function diff() {
    const envContent = fs.readFileSync('.env.migration', 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim() : null;
    };
    
    // Target
    const targetPass = getEnv('SUPABASE_TARGET_DB_PASSWORD');
    const targetRef = getEnv('SUPABASE_TARGET_PROJECT_REF');
    const targetUrl = `postgresql://postgres.${targetRef}:${encodeURIComponent(targetPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    
    // Source - using the default project ref if possible. We need the source db password.
    // Wait, the env has NEXT_PUBLIC_SUPABASE_URL (gixfypcwpeepjiqwlndk) but NOT the database password!
    // I can't connect to source with `pg` Client if I don't have the source DB password!
    // But I DO have SUPABASE_SERVICE_ROLE_KEY. Can I use Supabase REST API or RPC to get the schema?
    // Using postgrest to get information_schema is restricted unless exposed.
    // Let me check if we have the source db password in `.env` or somewhere.
}
diff();
