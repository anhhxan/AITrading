require('dotenv').config({ path: '.env.local' });
const { SequenceAuthority } = require('./src/core/infrastructure/SequenceAuthority.ts');
const { coreEventBus } = require('./src/core/infrastructure/EventBus.ts');
const { EventFactory } = require('./src/core/infrastructure/EventFactory.ts');

async function runTest() {
    console.log("Starting test...");
    const robotId = "test-robot-1";
    
    // Clear State
    SequenceAuthority.reset(robotId);
    coreEventBus.clearAll();

    // 1. Simulate Feed Event (seq 1)
    let seq1 = SequenceAuthority.next(robotId);
    let trace1 = EventFactory.createTrace('t1', 'parent', 'Feed', seq1);
    let ev1 = EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, trace1, { val: 1 });
    await coreEventBus.publish(ev1);
    console.log("Published Feed Event, seq:", seq1);
    
    // 2. Simulate TV Signal (seq 2)
    let seq2 = SequenceAuthority.next(robotId);
    let trace2 = EventFactory.createTrace('t2', 'parent', 'TV', seq2);
    let ev2 = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace2, { val: 2 });
    await coreEventBus.publish(ev2);
    console.log("Published TV Signal, seq:", seq2);

    // 3. Duplicate TV Signal (seq 2 again, same event ID -> should be rejected by idempotency)
    console.log("Publishing Duplicate TV Signal (should be ignored)...");
    await coreEventBus.publish(ev2);

    // 4. Stale Event (seq 1 again -> should be rejected because expected > 1)
    let staleTrace = EventFactory.createTrace('t3', 'parent', 'Feed', 1);
    let staleEv = EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, staleTrace, { val: 1 });
    console.log("Publishing Stale Event (should be ignored/dropped)...");
    await coreEventBus.publish(staleEv);

    // 5. Simulate State Event piggybacking (seq 2 again, but isInternalCausal)
    // Wait, state event piggybacks by having seq = current. Since we just processed seq2, current is 2!
    let trace3 = EventFactory.createTrace('t4', 'parent', 'State', 2);
    let ev3 = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, 1, trace3, { val: 3 });
    console.log("Publishing State Event (internal causal), seq:", 2);
    await coreEventBus.publish(ev3);

    console.log("Test execution finished without hanging!");
}
runTest().catch(console.error);
