require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupAndVacuum() {
    console.log('1. Fetching noisy events to delete...');
    const NOISE_EVENTS = [
        'REALTIME_PRICE_EVENT', 'PRICE_HEARTBEAT_EVENT', 'WORKER_HEARTBEAT', 
        'WORKER_HEARTBEAT_EVENT', 'SYSTEM_HEARTBEAT', 
        'REALTIME_PRICE_FEED_STALE', 'REALTIME_PRICE_FEED_CONNECTING', 
        'REALTIME_PRICE_FEED_DISCONNECTED', 'REALTIME_PRICE_FEED_CONNECTED'
    ];
    
    // We can't do DELETE directly with in() matching multiple types over 100k rows easily due to PostgREST limits.
    // Let's delete in batches or use a direct SQL if possible. But wait, if we delete ALL old core_events, we can just delete where created_at < NOW() - 2 days.
    // The user said: "7. DELETE toàn bộ dữ liệu core_events cũ"
    
    console.log('2. Deleting noisy events (regardless of age)...');
    let totalDeleted = 0;
    for (const evt of NOISE_EVENTS) {
        console.log(`Deleting ${evt}...`);
        const { error } = await supabase.from('core_events').delete().eq('event_type', evt);
        if (error) {
            console.error(`Error deleting ${evt}:`, error);
        } else {
            console.log(`Deleted ${evt} successfully.`);
        }
    }
    
    console.log('3. Deleting events older than 2 days...');
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { error: errOld } = await supabase.from('core_events').delete().lt('created_at', twoDaysAgo);
    if (errOld) {
        console.error('Error deleting old events:', errOld);
    } else {
        console.log('Deleted old events successfully.');
    }
    
    console.log('Done! Note: VACUUM/ANALYZE must be run manually via SQL Editor as Supabase JS cannot execute it.');
}

cleanupAndVacuum();
