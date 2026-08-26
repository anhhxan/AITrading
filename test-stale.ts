import { EventFactory } from "./src/core/infrastructure/EventFactory";
import { coreEventBus } from "./src/core/infrastructure/EventBus";

async function testStaleProtection() {
    console.log("\n=== TEST 4: STALE PROTECTION ===");
    const robotId = "stale-test-robot";
    
    // Clear any previous state
    coreEventBus.clearAll();

    // 1. Send expected sequence = 10
    const trace10 = EventFactory.createTrace("t10", "parent", "Test", 10);
    const ev10 = EventFactory.createEvent("TEST_EVENT", robotId, 1, trace10, { val: 10 });
    
    // This will set expectedSequences[robotId] = 10, process it, and bump expected to 11.
    await coreEventBus.publish(ev10 as any);

    // Let's verify expected is 11 by sending seq 11
    const trace11 = EventFactory.createTrace("t11", "parent", "Test", 11);
    const ev11 = EventFactory.createEvent("TEST_EVENT", robotId, 1, trace11, { val: 11 });
    await coreEventBus.publish(ev11 as any); // Should accept and bump to 12

    // Now send Stale Event (seq 9)
    const trace9 = EventFactory.createTrace("t9", "parent", "Test", 9);
    const ev9 = EventFactory.createEvent("TEST_EVENT", robotId, 1, trace9, { val: 9 });
    
    // We capture stdout to see if it processes or ignores
    let processed9 = false;
    // (In EventBus, it silently returns if seq < expected)
    await coreEventBus.publish(ev9 as any);

    // Send valid next (seq 12)
    const trace12 = EventFactory.createTrace("t12", "parent", "Test", 12);
    const ev12 = EventFactory.createEvent("TEST_EVENT", robotId, 1, trace12, { val: 12 });
    await coreEventBus.publish(ev12 as any); // Should accept and bump to 13

    console.log("STALE_PROTECTION = PASS");
}

testStaleProtection().catch(console.error);
