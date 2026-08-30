require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkEventNoise() {
    // Check distribution of last 5000 events
    const { data, error } = await supabase
        .from('core_events')
        .select('event_type')
        .order('created_at', { ascending: false })
        .limit(5000);
    
    if (error) {
        console.error('Error fetching events:', error);
        return;
    }
    
    const counts = {};
    for (const evt of data) {
        counts[evt.event_type] = (counts[evt.event_type] || 0) + 1;
    }
    console.log('Event distribution (last 5000):', counts);
}

checkEventNoise();
