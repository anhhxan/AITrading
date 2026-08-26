require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const afterTime = new Date(Date.now() - 10 * 60000).toISOString();
    const { data: events } = await supabase.from('core_events')
        .select('event_type, payload')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .eq('event_type', 'POSITION_OPENED_EVENT')
        .gte('created_at', afterTime);
    console.log(events);
    
    const { data: pos } = await supabase.from('robot_positions')
        .select('*')
        .eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b')
        .order('opened_at', { ascending: false })
        .limit(1);
    console.log("Positions:");
    console.log(pos);
}
check();
