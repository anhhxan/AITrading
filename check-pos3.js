require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: pos } = await supabase.from('active_positions')
        .select('*')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b');
    console.log("Positions:", pos);
}
check();
