const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.migration' });

async function inventory() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Source Supabase credentials in .env.local');
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Connecting to Source DB: ${supabaseUrl}`);
    
    const countQuery = async (table, filter = {}) => {
        let query = supabase.from(table).select('*', { count: 'exact', head: true });
        for (const [k, v] of Object.entries(filter)) {
            if (v === 'IS NULL') {
                query = query.is(k, null);
            } else if (v === 'IS NOT NULL') {
                query = query.not(k, 'is', null);
            } else if (Array.isArray(v) && v.length === 2 && v[0] === 'neq') {
                query = query.neq(k, v[1]);
            } else {
                query = query.eq(k, v);
            }
        }
        const { count, error } = await query;
        if (error) {
            console.error(`Error counting ${table}:`, error.message);
            return 0;
        }
        return count;
    };
    
    // Fetch counts
    const robots = await countQuery('robots');
    const robot_configs = await countQuery('robot_configs');
    const trade_history = await countQuery('trade_history'); // Valid?
    const active_setups = await countQuery('active_setups');
    const active_positions = await countQuery('active_positions');
    const active_orders = await countQuery('active_orders');
    const execution_intents = await countQuery('execution_intents');
    
    // Check setup_id IS NULL in LIVE tables
    const setups_null = 0; // setup_id in active_setups is NOT NULL in schema, but let's check
    const pos_null = await countQuery('active_positions', { setup_id: 'IS NULL' });
    const orders_null = await countQuery('active_orders', { setup_id: 'IS NULL' });
    const intents_null = await countQuery('execution_intents', { setup_id: 'IS NULL' });
    const history_null = await countQuery('trade_history', { setup_id: 'IS NULL' });
    
    // Fetch full arrays to check orphans and duplicates
    const { data: setupsData } = await supabase.from('active_setups').select('id, robot_id, setup_id, state');
    const { data: positionsData } = await supabase.from('active_positions').select('id, robot_id, setup_id');
    const { data: ordersData } = await supabase.from('active_orders').select('id, robot_id, setup_id, status');
    const { data: intentsData } = await supabase.from('execution_intents').select('id, robot_id, setup_id, status');
    
    const validSetupIds = new Set((setupsData || []).map(s => s.setup_id));
    
    let orphanPos = 0;
    for (const p of (positionsData || [])) {
        if (!validSetupIds.has(p.setup_id)) orphanPos++;
    }
    
    let orphanOrders = 0;
    for (const o of (ordersData || [])) {
        if (!validSetupIds.has(o.setup_id)) orphanOrders++;
    }
    
    let orphanIntents = 0;
    for (const i of (intentsData || [])) {
        if (!validSetupIds.has(i.setup_id)) orphanIntents++;
    }
    
    // Check duplicates
    const setupKeys = new Set();
    let duplicate_setup_id = 0;
    for (const s of (setupsData || [])) {
        const key = `${s.robot_id}_${s.setup_id}`;
        if (setupKeys.has(key)) duplicate_setup_id++;
        setupKeys.add(key);
    }
    
    // Auth Check
    // Can we fetch users?
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    const authStatus = userErr ? `FAIL (${userErr.message})` : `PASS (${users.users.length} users found, admin access OK)`;
    
    const report = `
# PRE-MIGRATION DATA INVENTORY

## TOTAL COUNTS (Source)
- robots: ${robots}
- robot_configs: ${robot_configs}
- trade_history: ${trade_history}
- active_setups: ${active_setups}
- active_positions: ${active_positions}
- active_orders: ${active_orders}
- execution_intents: ${execution_intents}

## DATA QUALITY & JUNK
- trade_history (setup_id IS NULL): ${history_null}
- active_positions (setup_id IS NULL): ${pos_null}
- active_orders (setup_id IS NULL): ${orders_null}
- execution_intents (setup_id IS NULL): ${intents_null}
- duplicate setup_id in active_setups: ${duplicate_setup_id}

## ORPHANS (Not in active_setups)
- active_positions (orphan): ${orphanPos}
- active_orders (orphan): ${orphanOrders}
- execution_intents (orphan): ${orphanIntents}

## AUTH MIGRATION STATUS
- Auth users access: ${authStatus}
    `;
    
    fs.writeFileSync('C:\\Users\\pc\\.gemini\\antigravity\\brain\\e2d27aed-689b-4379-bf61-e6836f7d3f9c\\PRE_MIGRATION_INVENTORY.md', report.trim());
    console.log('Inventory generated.');
}

inventory();
