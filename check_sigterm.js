const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '8f53a0ad-18bd-4296-ac20-890f3e9017d6';
    const robotId = '7e95b9b5-e113-4d61-92a6-26c9979e7ebc';
    
    console.log("=== 1. ROBOT COMMANDS ===");
    const { data: cmds } = await supabase.from('robot_commands')
        .select('*')
        .contains('result', { testId: testId })
        .order('created_at', { ascending: false });
        
    cmds?.forEach(cmd => {
        console.log(`Command ID: ${cmd.command_id}`);
        console.log(`Status: ${cmd.status}`);
        console.log(`Worker ID: ${cmd.worker_id}`);
        console.log(`Processed At: ${cmd.processed_at}`);
        console.log(`Result testId: ${cmd.result?.testId}`);
        console.log(`Correlation ID: ${cmd.correlation_id}`);
    });

    console.log("\n=== 2. ACTIVE SETUPS ===");
    const { data: setups } = await supabase.from('active_setups')
        .select('*')
        .eq('robot_id', robotId);
        
    setups?.forEach(s => {
        console.log(`Setup ID: ${s.setup_id}`);
        console.log(`State: ${s.state}`);
        console.log(`Direction: ${s.direction}`);
        console.log(`Trigger Price: ${s.trigger_price}`);
        console.log(`Is Armed: ${s.is_armed}`);
        console.log(`Has Snapshot: ${!!s.snapshot}`);
        if (s.snapshot) {
            console.log(`Snapshot barTimestamp: ${s.snapshot.payload?.barTimestamp || s.snapshot.barTimestamp}`);
            console.log(`Snapshot entryTrigger: ${JSON.stringify(s.snapshot.entryTrigger)}`);
            console.log(`Snapshot armBounds: ${JSON.stringify(s.snapshot.armBounds)}`);
            console.log(`Snapshot indicatorReference: ${JSON.stringify(s.snapshot.indicatorReference)}`);
        }
    });
    if (!setups || setups.length === 0) console.log("No active setups found.");

    console.log("\n=== 3. ROBOT STATE ===");
    const { data: robot } = await supabase.from('robots').select('current_state').eq('id', robotId).single();
    if (robot) console.log(`Current State: ${robot.current_state}`);
    else console.log("Robot not found.");

    console.log("\n=== 4. CORE EVENTS ===");
    if (cmds && cmds.length > 0) {
        const { data: events } = await supabase.from('core_events')
            .select('event_type, created_at, payload')
            .eq('correlation_id', cmds[0].correlation_id)
            .order('created_at', { ascending: true });
        events?.forEach(e => console.log(`${e.event_type} at ${e.created_at}`));
        if (!events || events.length === 0) console.log("No core events found.");
    }

    console.log("\n=== 5. PAPER EXECUTION ===");
    const { data: intents } = await supabase.from('execution_intents')
        .select('*')
        .eq('robot_id', robotId)
        .order('created_at', { ascending: false })
        .limit(3);
    intents?.forEach(i => console.log(`Intent ID: ${i.id} | Status: ${i.status} | Created At: ${i.created_at}`));
    if (!intents || intents.length === 0) console.log("No execution intents found.");
}
run();
