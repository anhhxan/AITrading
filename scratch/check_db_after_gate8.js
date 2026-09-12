require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';

async function run() {
    console.log("=== DB CHECK ===");
    
    let { data: cmds } = await supabase.from('robot_commands').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(2);
    console.log("Latest commands:", cmds.map(c => ({ status: c.status, type: c.command_type })));

    let { data: state } = await supabase.from('robots').select('current_state').eq('id', robotId).single();
    console.log("Robot State:", state);

    let { data: setups } = await supabase.from('active_setups').select('*').eq('robot_id', robotId);
    console.log("Setups count:", setups.length);

    let { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', robotId);
    console.log("Intents count:", intents.length);

    let { data: orders } = await supabase.from('active_orders').select('*').eq('robot_id', robotId);
    console.log("Orders count:", orders.length);

    let { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', robotId);
    console.log("Positions:", positions.map(p => ({ id: p.id, side: p.side, status: p.status, entry: p.entry_price, SL: p.stop_loss_price, TP: p.take_profit_price })));
}

run();
