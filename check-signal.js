require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const afterTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    console.log("Commands:");
    const { data: cmds } = await supabase.from('robot_commands')
        .select('command_id, status, created_at, processed_at')
        .eq('command_type', 'TV_SIGNAL')
        .gte('created_at', afterTime)
        .order('created_at', { ascending: false });
    console.log(cmds);
    
    console.log("\nEvents:");
    const { data: events } = await supabase.from('core_events')
        .select('event_type, event_sequence, payload')
        .in('event_type', ['STRATEGY_SIGNAL_EVENT', 'STATE_TRANSITION_EVENT', 'RETRACEMENT_ZONE_TOUCHED', 'RETRACEMENT_ENTRY_TRIGGERED'])
        .gte('created_at', afterTime)
        .order('created_at', { ascending: false });
        
    if(events) events.forEach(e => {
        console.log(`[Seq ${e.event_sequence}] ${e.event_type}`);
        if(e.event_type === 'STATE_TRANSITION_EVENT') console.log("State:", e.payload.previousState, "->", e.payload.newState);
        if(e.event_type === 'STRATEGY_SIGNAL_EVENT') console.log("Signal:", e.payload.direction, e.payload.entryTrigger);
        if(e.event_type === 'RETRACEMENT_ZONE_TOUCHED') console.log("Touched zone:", e.payload);
        if(e.event_type === 'RETRACEMENT_ENTRY_TRIGGERED') console.log("Entry triggered:", e.payload);
    });
}
check();
