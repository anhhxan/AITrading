require('dotenv').config({ path: '.env.local' });
const { RiskEngine } = require('./src/core/engine/risk/RiskEngine');

async function run() {
  const engine = new RiskEngine();
  
  const mockConfig = {
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    executionSymbol: 'BTCUSDT',
    timeframe: '15m',
    accountBalance: 10000,
    positionAllocationPercent: 10,
    leverage: 1
  };
  
  const stateEvent = {
    eventType: 'STATE_TRANSITION_EVENT',
    eventId: 'test',
    robotId: '33f9c37d-64ef-4a01-8aa3-05a1d897c193',
    timestamp: Date.now(),
    trace: { correlationId: 'test-size-1', sequence: 1, path: [] },
    configVersion: 1,
    oldState: 'WAIT_SIGNAL',
    newState: 'READY_TO_ENTER',
    context: {
      direction: 'LONG',
      action: 'OPEN',
      entryReferencePrice: 90000,
      indicatorSnapshot: {
        name: 'BB',
        config: { mult: 2, mult2: 1, length: 20, source: 'close' },
        snapshot: { line1: 100000, line5: 90000 }
      }
    }
  };
  
  engine.registerRobotConfig(stateEvent.robotId, mockConfig);
  
  const { coreEventBus } = require('./src/core/infrastructure/EventBus');
  coreEventBus.publish = async (ev) => {
    console.log("TRADE_PLAN_EVENT Emitted:");
    console.log(JSON.stringify(ev, null, 2));
  };
  
  await engine['handleReadyToEnter'](stateEvent);
}

run();
