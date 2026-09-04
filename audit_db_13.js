const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: configs, error } = await supabase
        .from('robot_configs')
        .select(`
            robot_id, strategy_id, strategy_params, indicator_profile, risk_profile,
            robots!inner(timeframe, trading_view_symbol, execution_symbol, paper_balance, status, current_state)
        `)
        .eq('status', 'ACTIVE')
        .eq('robots.status', 'RUNNING');
    console.log(error || configs);
}
run();
