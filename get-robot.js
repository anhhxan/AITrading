require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: robots } = await supabase
        .from('robots')
        .select('*')
        .eq('status', 'RUNNING')
        .eq('trading_mode', 'PAPER');
    
    console.log("RUNNING PAPER ROBOTS:", robots.map(r => ({ id: r.id, name: r.name, symbol: r.trading_view_symbol })));
}
check();
