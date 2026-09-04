const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const robotId = '7e95b9b5-e113-4d61-92a6-26c9979e7ebc';
    const { data: configData, error: configErr } = await supabase
        .from('robot_configs')
        .select(`
            risk_profile,
            robots (current_state, timeframe, trading_view_symbol, execution_symbol, paper_balance)
        `)
        .eq('robot_id', robotId)
        .eq('status', 'ACTIVE')
        .single();
    console.log("Error:", configErr);
    console.log("Data:", configData);
}
run();
