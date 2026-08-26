require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extract() {
    const robotId = '8bf86ec5-41a4-4d11-9998-d486d23db18b';
    const afterTime = new Date(Date.now() - 60 * 60000).toISOString();
    
    const { data: events } = await supabase.from('core_events')
        .select('event_type, event_sequence, payload, created_at')
        .eq('robot_id', robotId)
        .in('event_type', [
            'STRATEGY_SIGNAL_EVENT', 
            'STATE_TRANSITION_EVENT', 
            'RETRACEMENT_ZONE_TOUCHED', 
            'RETRACEMENT_ENTRY_TRIGGERED', 
            'TRADE_PLAN_EVENT', 
            'POSITION_OPENED_EVENT'
        ])
        .gte('created_at', afterTime)
        .order('created_at', { ascending: true });
        
    console.log(`Trace Events: ${events?.length || 0}`);
    if (events) {
        events.forEach(e => {
            console.log(`[Seq ${e.event_sequence}] ${e.event_type} at ${e.created_at}`);
            if(e.event_type === 'STATE_TRANSITION_EVENT') console.log(`   ${e.payload.previousState} -> ${e.payload.newState}`);
            if(e.event_type === 'RETRACEMENT_ENTRY_TRIGGERED') console.log(`   Trigger Price: ${e.payload.trigger_price || e.payload.entryReferencePrice}`);
        });
    }
}
extract();
