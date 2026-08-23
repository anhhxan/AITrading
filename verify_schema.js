const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
    console.log('--- STEP 2: VERIFYING SCHEMA ---');
    
    // 1. Check if table exists
    const { data, error } = await supabase.from('signal_trace_events').select('*').limit(1);
    if (error) {
        console.error('❌ Table check failed:', error.message);
        process.exit(1);
    }
    console.log('✅ Table `signal_trace_events` exists.');

    // 2. Test UNIQUE constraint
    const testRobotId = 'f1610ab1-3177-4930-81fc-6cd98262d7b6';
    const testTimestamp = 9999999999999;
    
    // Cleanup any previous test data
    await supabase.from('signal_trace_events').delete().eq('robot_id', testRobotId).eq('bar_timestamp', testTimestamp);

    const payload = {
        robot_id: testRobotId,
        bar_timestamp: testTimestamp,
        time_utc: new Date(testTimestamp).toISOString(),
        timeframe: '1m',
        candle_trace_id: `1m_${testTimestamp}`
    };

    // First insert should succeed
    const { error: err1 } = await supabase.from('signal_trace_events').insert(payload);
    if (err1) {
        console.error('❌ First insert failed:', err1.message);
        process.exit(1);
    }
    console.log('✅ Inserted first test record.');

    // Second insert with same robot_id and bar_timestamp should fail with duplicate key
    const { error: err2 } = await supabase.from('signal_trace_events').insert(payload);
    if (err2 && err2.code === '23505') {
        console.log('✅ UNIQUE(robot_id, bar_timestamp) constraint is active and correctly rejected duplicate.');
    } else {
        console.error('❌ UNIQUE constraint check failed. Expected 23505, got:', err2);
        process.exit(1);
    }

    // Upsert test (should succeed without error)
    const { error: err3 } = await supabase.from('signal_trace_events').upsert({
        ...payload,
        cf_status: 'GREEN'
    }, { onConflict: 'robot_id, bar_timestamp' });
    
    if (err3) {
        console.error('❌ Upsert test failed:', err3.message);
        process.exit(1);
    }
    console.log('✅ UPSERT on unique constraint works perfectly.');

    // Cleanup
    await supabase.from('signal_trace_events').delete().eq('robot_id', testRobotId).eq('bar_timestamp', testTimestamp);
    console.log('✅ Test data cleaned up.');
    
    console.log('\n✅ SCHEMA VERIFICATION PASSED!');
}

verifySchema().catch(console.error);
