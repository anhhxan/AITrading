const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

async function checkOrphans() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: robots } = await supabase.from('robots').select('id');
    const robotIds = new Set(robots.map(r => r.id));
    
    const { data: configs } = await supabase.from('robot_configs').select('robot_id');
    let orphanConfigs = 0;
    for (const c of configs) {
        if (!robotIds.has(c.robot_id)) orphanConfigs++;
    }
    
    const { data: history } = await supabase.from('trade_history').select('robot_id');
    let orphanHistory = 0;
    for (const h of history) {
        if (!robotIds.has(h.robot_id)) orphanHistory++;
    }
    
    console.log(`Orphan configs: ${orphanConfigs}, Orphan history: ${orphanHistory}`);
}

checkOrphans();
