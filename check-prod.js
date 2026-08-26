require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log("Checking for PAPER_WORKER_STARTING event...");
    const { data: startEvents } = await supabase
        .from('core_events')
        .select('*')
        .eq('event_type', 'PAPER_WORKER_STARTING')
        .order('timestamp', { ascending: false })
        .limit(1);

    if (startEvents && startEvents.length > 0) {
        console.log("Worker Started At:", new Date(startEvents[0].timestamp).toISOString());
        console.log("Payload:", startEvents[0].payload);
    } else {
        console.log("No STARTING event found.");
    }

    console.log("\nChecking for PRICE_HEARTBEAT_EVENT...");
    const { data: heartbeats } = await supabase
        .from('core_events')
        .select('*')
        .eq('event_type', 'PRICE_HEARTBEAT_EVENT')
        .order('timestamp', { ascending: false })
        .limit(1);

    if (heartbeats && heartbeats.length > 0) {
        console.log("Last Heartbeat:", new Date(heartbeats[0].timestamp).toISOString());
        console.log("Payload:", heartbeats[0].payload);
    } else {
        console.log("No HEARTBEAT event found.");
    }

    console.log("\nChecking for REALTIME_PRICE_EVENT...");
    const { data: prices } = await supabase
        .from('core_events')
        .select('*')
        .eq('event_type', 'REALTIME_PRICE_EVENT')
        .order('timestamp', { ascending: false })
        .limit(1);

    if (prices && prices.length > 0) {
        console.log("Last Price Event:", new Date(prices[0].timestamp).toISOString());
        console.log("Payload:", prices[0].payload);
    } else {
        console.log("No PRICE event found.");
    }
}
check();
