const { coreEventBus: bus1 } = require('./src/worker/CommandPoller.ts');
const { coreEventBus: bus2 } = require('./src/core/engine/strategies/StrategyEngine.ts');

console.log("Are they the same?", bus1 === bus2);
