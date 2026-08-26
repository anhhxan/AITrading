require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('execution_intents').insert({
        robot_id: '8bf86ec5-41a4-4d11-9998-d486d23db18b',
        signal_id: 'test',
        client_order_id: 'test',
        action: 'OPEN_LONG',
        symbol: 'BTCUSDT',
        order_type: 'MARKET',
        quantity: 1,
        price: 10000,
        status: 'PENDING'
    });
    console.log(error || "Success");
}
check();
