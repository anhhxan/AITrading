const { SequenceAuthority } = require('./src/core/infrastructure/SequenceAuthority.ts');

async function testConcurrentAndSingleton() {
    console.log("=== TEST 1 & 5: CONCURRENT PRODUCERS & SINGLETON ===");
    const robotId = "robot-concurrent";
    SequenceAuthority.reset(robotId);

    // Simulate concurrent calls (Promise.all)
    const promises = [];
    for(let i=0; i<100; i++) {
        promises.push(new Promise(resolve => {
            // Random delay to simulate real concurrent I/O unpredictability
            setTimeout(() => {
                resolve(SequenceAuthority.next(robotId));
            }, Math.random() * 10);
        }));
    }

    const results = await Promise.all(promises);
    const uniqueResults = new Set(results);

    // If size is 100 and max is 100, then it incremented atomically without duplicates.
    const hasDuplicates = results.length !== uniqueResults.size;
    const maxSeq = Math.max(...results);
    const minSeq = Math.min(...results);

    if (!hasDuplicates && minSeq === 1 && maxSeq === 100) {
        console.log("CONCURRENT: PASS (No duplicates, perfectly atomic)");
        console.log("SINGLETON: PASS (All promises shared the same instance counter)");
    } else {
        console.log("CONCURRENT/SINGLETON: FAIL", {hasDuplicates, minSeq, maxSeq});
    }
}

async function testMultiRobot() {
    console.log("\n=== TEST 2: MULTI ROBOT ===");
    const robotA = "robot-A";
    const robotB = "robot-B";
    SequenceAuthority.reset(robotA);
    SequenceAuthority.reset(robotB);

    const a1 = SequenceAuthority.next(robotA);
    const a2 = SequenceAuthority.next(robotA);
    const b1 = SequenceAuthority.next(robotB);
    const a3 = SequenceAuthority.next(robotA);
    const b2 = SequenceAuthority.next(robotB);

    if (a1 === 1 && a2 === 2 && a3 === 3 && b1 === 1 && b2 === 2) {
        console.log("MULTI_ROBOT: PASS (Independent sequences)");
    } else {
        console.log("MULTI_ROBOT: FAIL");
    }
}

async function runAll() {
    await testConcurrentAndSingleton();
    await testMultiRobot();
}

runAll();
