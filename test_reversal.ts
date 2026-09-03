

const { EventBus } = require('./src/core/infrastructure/EventBus.ts');
const { coreEventBus } = require('./src/core/infrastructure/EventBus.ts');
const { StateMachineEngine } = require('./src/core/engine/runtime/StateMachineEngine.ts');
const { PaperPositionTracker } = require('./src/core/engine/execution/PaperPositionTracker.ts');
const { EventFactory } = require('./src/core/infrastructure/EventFactory.ts');
const { RobotState } = require('./src/core/interfaces/PluginInterfaces.ts');
require('dotenv').config({ path: '.env.local' });

async function testReversal() {
    console.log('--- STARTING REVERSAL TEST ---');
    const fsm = new StateMachineEngine('FSM-01');
    const tracker = new PaperPositionTracker('TRK-01');

    await fsm.initialize();
    await tracker.initialize();

    const robotId = '7e95b9b5-e113-4d61-92a6-26c9979e7ebc';
    fsm.registerRobot(robotId, '1m');

    // Manually force FSM to POSITION_OPEN for LONG
    fsm.states.set(robotId, 'POSITION_OPEN');
    fsm['activePositions'].set(robotId, { side: 'LONG', sl: 9000, tp: 11000, symbol: 'BTCUSDT' });
    tracker['activePositions'].set(robotId, { robot_id: robotId, side: 'LONG', symbol: 'BTCUSDT', quantity: 1, entry_price: 10000 });
    
    let forceCloseEmitted = false;
    let posClosedEmitted = false;
    
    coreEventBus.subscribe('FORCE_CLOSE_POSITION_EVENT', async (e) => {
        forceCloseEmitted = true;
        console.log('TEST: Received FORCE_CLOSE_POSITION_EVENT');
    });

    coreEventBus.subscribe('POSITION_CLOSED_EVENT', async (e) => {
        posClosedEmitted = true;
        console.log('TEST: Received POSITION_CLOSED_EVENT', e.payload.side);
    });

    console.log('Emit SHORT signal (Reversal)');
    const trace = EventFactory.createTrace('test-corr', 'ev-1', 'TEST', 1);
    const shortSignal = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
        direction: 'SHORT',
        barTimestamp: Date.now()
    });

    await coreEventBus.publish(shortSignal);

    // Wait a bit for async processing
    await new Promise(r => setTimeout(r, 5000));

    console.log('Force close emitted:', forceCloseEmitted);
    console.log('Pos closed emitted:', posClosedEmitted);
    console.log('Final state:', fsm.states.get(robotId));
    console.log('Pending signals size:', fsm['pendingReversalSignals'].size);
    
    process.exit(0);
}

testReversal();





