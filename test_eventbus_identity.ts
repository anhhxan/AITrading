const { coreEventBus: bus1 } = require('./src/worker/CommandPoller.ts');
const { coreEventBus: bus2 } = require('./src/worker/RuntimeManager.ts');
const { coreEventBus: bus3 } = require('./src/core/engine/strategies/StrategyEngine.ts');
const { coreEventBus: bus4 } = require('./src/core/engine/runtime/StateMachineEngine.ts');
const { coreEventBus: bus5 } = require('./src/core/engine/runtime/RealtimePriceFeed.ts');

console.log("CommandPoller === RuntimeManager:", bus1 === bus2);
console.log("CommandPoller === StrategyEngine:", bus1 === bus3);
console.log("CommandPoller === StateMachineEngine:", bus1 === bus4);
console.log("CommandPoller === RealtimePriceFeed:", bus1 === bus5);
console.log("StrategyEngine === StateMachineEngine:", bus3 === bus4);
