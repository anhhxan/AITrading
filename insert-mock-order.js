require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: i } = await supabase.from('execution_intents').insert({
        robot_id: '8bf86ec5-41a4-4d11-9998-d486d23db18b',
        signal_id: 'test',
        client_order_id: 'test',
        action: 'OPEN_LONG',
        symbol: 'BTCUSDT',
        order_type: 'MARKET',
        quantity: 1,
        price: 10000,
        leverage: 1,
        status: 'PENDING'
    }).select('id').single();
    
    if (i) {
        const { error } = await supabase.from('active_orders').insert({
            intent_id: i.id,
            robot_id: '8bf86ec5-41a4-4d11-9998-d486d23db18b',
            binance_order_id: 'test',
            client_order_id: 'test',
            symbol: 'BTCUSDT',
            side: 'BUY',
            order_type: 'MARKET',
            quantity: 1,
            price: 10000,
            filled_quantity: 1,
            average_fill_price: 10000,
            status: 'FILLED'
        });
        console.log("Order err:", error || "Success");
    }
}
check();
