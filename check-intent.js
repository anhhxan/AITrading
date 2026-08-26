require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const afterTime = new Date(Date.now() - 15 * 60000).toISOString();
    const { data: intents } = await supabase.from('execution_intents')
        .select('*')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .gte('created_at', afterTime);
    console.log("Intents:", intents);
    
    const { data: orders } = await supabase.from('active_orders')
        .select('*')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .gte('created_at', afterTime);
    console.log("Orders:", orders);
}
check();
