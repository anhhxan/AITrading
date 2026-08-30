const { Client } = require('pg');
const fs = require('fs');

async function partialDiff() {
    const envContent = fs.readFileSync('.env.migration', 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim() : null;
    };
    
    // Target
    const targetPass = getEnv('SUPABASE_TARGET_DB_PASSWORD');
    const targetRef = getEnv('SUPABASE_TARGET_PROJECT_REF');
    const targetUrl = `postgresql://postgres.${targetRef}:${encodeURIComponent(targetPass)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
    const targetClient = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
    await targetClient.connect();

    // Source (OpenAPI)
    const openapi = require('./source_openapi.json');
    const sourceTables = openapi.definitions || {};

    // Get Target columns
    const targetCols = await targetClient.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
    `);
    
    const targetSchema = {};
    targetCols.rows.forEach(r => {
        if (!targetSchema[r.table_name]) targetSchema[r.table_name] = {};
        targetSchema[r.table_name][r.column_name] = r.data_type;
    });

    let diffLines = ['# PHASE 3.11B - PARTIAL SCHEMA DIFF (COLUMNS)'];
    diffLines.push('| Object | Source | Target | Difference |');
    diffLines.push('|---|---|---|---|');

    // Compare Source -> Target
    for (const [tableName, tableDef] of Object.entries(sourceTables)) {
        if (!targetSchema[tableName]) {
            diffLines.push(`| Table \`${tableName}\` | EXISTS | MISSING | Table missing in Target |`);
            continue;
        }

        const sourceProps = tableDef.properties || {};
        for (const [colName, colDef] of Object.entries(sourceProps)) {
            if (!targetSchema[tableName][colName]) {
                diffLines.push(`| \`${tableName}.${colName}\` | EXISTS | MISSING | Column missing in Target |`);
            }
        }
    }

    // Compare Target -> Source
    for (const [tableName, cols] of Object.entries(targetSchema)) {
        if (!sourceTables[tableName]) {
            diffLines.push(`| Table \`${tableName}\` | MISSING | EXISTS | Table exists in Target but not Source |`);
            continue;
        }

        for (const colName of Object.keys(cols)) {
            if (!sourceTables[tableName].properties[colName]) {
                diffLines.push(`| \`${tableName}.${colName}\` | MISSING | EXISTS | Column exists in Target but not Source |`);
            }
        }
    }

    fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\PARTIAL_DIFF.md', diffLines.join('\n'));
    console.log('Partial diff generated.');
    await targetClient.end();
}

partialDiff().catch(console.error);
