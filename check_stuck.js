const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const testId = '8f53a0ad-18bd-4296-ac20-890f3e9017d6';
    const robotId = '7e95b9b5-e113-4d61-92a6-26c9979e7ebc';
    
    console.log("=== 1. ROBOT COMMANDS ===");
    const { data: cmd } = await supabase.from('robot_commands')
        .select('*')
        .contains('result', { testId: testId })
        .order('created_at', { ascending: false })
        .limit(1).single();
        
    if (cmd) {
        console.log(`Command ID: ${cmd.command_id}`);
        console.log(`Status: ${cmd.status}`);
        console.log(`Worker ID: ${cmd.worker_id}`);
        console.log(`Attempt Count: ${cmd.attempt_count}`);
        console.log(`Claimed At: ${cmd.claimed_at}`);
        console.log(`Processing Started At: ${cmd.processing_started_at}`);
        console.log(`Processed At: ${cmd.processed_at}`);
        console.log(`Updated At: ${cmd.updated_at || cmd.created_at}`); // updated_at might not exist, but let's see
        console.log(`Correlation ID: ${cmd.correlation_id}`);
    }

    console.log("\n=== 2. ACTIVE SETUPS ===");
    const { data: setup } = await supabase.from('active_setups')
        .select('*')
        .eq('robot_id', robotId).single();
        
    if (setup) {
        console.log(`State: ${setup.state}`);
        console.log(`Direction: ${setup.direction}`);
        console.log(`Trigger Price: ${setup.trigger_price}`);
        console.log(`Is Armed: ${setup.is_armed}`);
        console.log(`Snapshot correlation/testId: ${setup.snapshot?.payload?.testId || setup.snapshot?.testId}`);
        console.log(`Updated At: ${setup.updated_at || setup.created_at}`);
    }
}
run();
