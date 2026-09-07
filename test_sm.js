const { StateMachineEngine } = require('./src/core/engine/runtime/StateMachineEngine.ts');
const { RobotState } = require('./src/core/types/enums.ts');

const sm = new StateMachineEngine();
const robotId = 'test-robot';

sm.states.set(robotId, RobotState.WAIT_CANDLE_B_CONFIRMATION);
sm.activeSignals.set(robotId, {
    entryTrigger: { lower: 0, upper: 101 },
    trace: { correlationId: 'test' }
});
sm.armedSignals.set(robotId, true);

async function run() {
    console.log("Triggering 101...");
    const res = await sm.handleRealtimePrice({
        robotId,
        price: 101,
        eventId: 'test',
        trace: { sequence: 1 }
    });
    console.log("Result:", res);
}
run();
