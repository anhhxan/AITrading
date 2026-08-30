import { RiskEngine, RiskConfig } from './core/engine/risk/RiskEngine';
import { coreEventBus } from './core/infrastructure/EventBus';
import { EventFactory } from './core/infrastructure/EventFactory';
import { RobotState } from './core/engine/runtime/StateMachineEngine';

async function test() {
  const robotId = 'RobotR1';
  const defaultRiskConfig: RiskConfig = {
    tradingViewSymbol: 'BTCUSDT', executionSymbol: 'BTCUSDT', timeframe: '15m',
    accountBalance: 10000,
    positionAllocationPercent: 20,
    
    leverage: 1
  };

  const engine = new RiskEngine();
  await engine.initialize();
  engine.registerRobotConfig(robotId, defaultRiskConfig);

  coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e) => { console.log('TRADE_PLAN:', e); });
  coreEventBus.subscribe('RISK_REJECTED_EVENT', async (e) => { console.log('RISK_REJECTED:', e); });

  const signal = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1 /* configVersion */, EventFactory.createTrace(`corr-22`, 'ind-event', 'strat', 22), {
    direction: 'LONG',
    maxTimeoutCandles: 3,
    strategyId: 'BB_Strategy',
    strategyVersion: 'v1.0.0',
    indicatorReference: {
      name: 'BB_MB',
      config: { length: 20, source: 'close', mult: 2, mult2: 1 },
      snapshot: { line1: 110, line2: 109, line3: 100, line4: 91, line5: 90 }
    }
  });

  const ready = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, 1 /* configVersion */, EventFactory.createTrace('corr-22', `candle-24`, 'fsm', 24), {
    previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
    newState: RobotState.READY_TO_ENTER,
    reason: 'TRIGGER_MATCHED',
    triggerPrice: 99
  });

  console.log('Publishing signal');
  await coreEventBus.publish(signal as any);
  console.log('Publishing ready');
  await coreEventBus.publish(ready as any);
  
  await coreEventBus.waitForIdle(robotId);
  console.log('Done');
}

test().catch(console.error);
