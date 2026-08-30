const { Client } = require('pg');
const fs = require('fs');

async function checkEnv() {
    const env = fs.readFileSync('.env.local', 'utf8');
    if (!env.includes('qusucvfcrtaayensmzht')) throw new Error('ENV does not point to Target');
    
    const dbPass = fs.readFileSync('.env.migration','utf8').match(/^SUPABASE_TARGET_DB_PASSWORD=(.*)$/m)[1].trim();
    const client = new Client({ 
        connectionString: 'postgresql://postgres.qusucvfcrtaayensmzht:' + encodeURIComponent(dbPass) + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres', 
        ssl: {rejectUnauthorized: false} 
    });
    await client.connect();

    const tables = [
        'robots', 'robot_configs', 'active_setups', 'active_positions',
        'active_orders', 'execution_intents', 'trade_history',
        'robot_commands', 'core_events'
    ];

    console.log("== T1 CLEAN DB ==");
    for (const t of tables) {
        const { rows } = await client.query(`SELECT count(*) FROM ${t}`);
        console.log(`${t}: ${rows[0].count}`);
        if (parseInt(rows[0].count) !== 0) {
            console.error(`Table ${t} is not clean!`);
            process.exit(1);
        }
    }
    console.log("CLEAN.");
    await client.end();
}
checkEnv().catch(console.error);
