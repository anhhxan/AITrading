const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
    console.log('--- DATABASE AUDIT ---');
    
    // 1. Check robots
    const { data: robots } = await supabase.from('robots').select('id, timeframe, trading_mode, execution_symbol');
    console.log('ROBOTS:', robots);

    // 2. Check recent robot_commands
    const { data: commands } = await supabase.from('robot_commands').select('*').order('created_at', { ascending: false }).limit(5);
    console.log('\nRECENT COMMANDS:');
    commands.forEach(c => console.log(c.created_at + ' | ' + c.robot_id + ' | ' + c.status + ' | id: ' + c.id));

    // 3. Check core_events
    const { data: events } = await supabase.from('core_events').select('event_type, timestamp, robot_id, event_sequence').order('timestamp', { ascending: false }).limit(10);
    console.log('\nRECENT CORE EVENTS:');
    if(events) events.forEach(e => console.log(new Date(e.timestamp).toISOString() + ' | ' + e.robot_id + ' | ' + e.event_type + ' | seq: ' + e.event_sequence));

    // 4. Check signal_trace_events
    const { data: traces } = await supabase.from('signal_trace_events').select('created_at, robot_id, strategy_id, status, signal_direction').order('created_at', { ascending: false }).limit(5);
    console.log('\nRECENT SIGNAL TRACES:');
    if(traces) traces.forEach(t => console.log(t.created_at + ' | ' + t.robot_id + ' | ' + t.status + ' | dir: ' + t.signal_direction));
    
    // 5. Check active_setups (to see if new schema is present)
    const { data: setups } = await supabase.from('active_setups').select('*');
    console.log('\nACTIVE SETUPS:');
    console.log(setups);

    // 6. Check paper_positions_history
    const { data: history } = await supabase.from('paper_positions_history').select('*').order('closed_at', { ascending: false }).limit(5);
    console.log('\nPAPER POSITIONS HISTORY:');
    console.log(history && history.length > 0 ? history : 'Empty');
}

runAudit().catch(console.error);
