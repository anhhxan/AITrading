const { Client } = require('pg');
const fs = require('fs');

async function auditFull() {
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
        
        let report = `# PHASE 3.10_SCHEMA_COMPARISON (TARGET)\n\n`;
        
        const tablesToCheck = ['robots', 'robot_configs', 'active_setups', 'execution_intents', 'active_orders', 'active_positions', 'trade_history', 'robot_commands', 'core_events'];
        
        report += `## TABLES\n`;
        for (const t of tablesToCheck) {
            const res = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [t]);
            report += `- ${t}: ${res.rowCount > 0 ? 'PASS' : 'FAIL (missing)'}\n`;
        }
        
        report += `\n## COLUMNS & CONSTRAINTS (active_setups)\n`;
        const colSetupId = await client.query(`SELECT is_nullable, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='active_setups' AND column_name='setup_id'`);
        if (colSetupId.rowCount > 0) {
            const c = colSetupId.rows[0];
            report += `- setup_id: ${c.data_type}(${c.character_maximum_length}) NULLABLE=${c.is_nullable}\n`;
        } else {
            report += `- setup_id: MISSING\n`;
        }
        
        const uniqSetup = await client.query(`
            SELECT tc.constraint_name 
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
            WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = 'active_setups'
            GROUP BY tc.constraint_name
            HAVING count(*) = 2 AND SUM(CASE WHEN ccu.column_name IN ('robot_id', 'setup_id') THEN 1 ELSE 0 END) = 2
        `);
        report += `- UNIQUE(robot_id, setup_id): ${uniqSetup.rowCount > 0 ? 'PASS (' + uniqSetup.rows[0].constraint_name + ')' : 'FAIL'}\n`;
        
        report += `\n## COLUMNS (Execution Tables)\n`;
        for (const t of ['execution_intents', 'active_orders', 'active_positions', 'trade_history']) {
            const c = await client.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name=$1 AND column_name='setup_id'`, [t]);
            report += `- ${t}.setup_id: ${c.rowCount > 0 ? 'PASS (Nullable=' + c.rows[0].is_nullable + ')' : 'FAIL'}\n`;
        }
        
        report += `\n## INDEXES\n`;
        const idx = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE '%setup_id%'`);
        for (const r of idx.rows) {
            report += `- ${r.indexname}\n`;
        }
        
        report += `\n## FOREIGN KEYS (robots relation)\n`;
        const fk = await client.query(`
            SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
            WHERE constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'robots'
        `);
        for (const r of fk.rows) {
            report += `- ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}\n`;
        }
        
        report += `\n## RLS & POLICIES\n`;
        const rls = await client.query(`SELECT relname, relrowsecurity FROM pg_class WHERE oid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace) AND relname IN ('active_setups', 'active_orders', 'active_positions', 'execution_intents', 'trade_history')`);
        for (const r of rls.rows) {
            report += `- ${r.relname} RLS ENABLED: ${r.relrowsecurity}\n`;
        }
        
        fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\phase3.10_schema_comparison.md', report);
        console.log('Report written to phase3.10_schema_comparison.md');
        
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
auditFull();
