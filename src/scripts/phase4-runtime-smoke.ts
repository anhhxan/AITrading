import { EngineOrchestrator } from '../core/engine/runtime/EngineOrchestrator';
import { RiskEngine, RiskConfig } from '../core/engine/risk/RiskEngine';
import { coreEventBus } from '../core/infrastructure/EventBus';
import { EventFactory } from '../core/infrastructure/EventFactory';
import { RobotState } from '../core/engine/runtime/StateMachineEngine';

async function runPhase4SmokeTest() {
  console.log('--- STARTING PHASE 4 RUNTIME SMOKE TEST ---');
  const orchestrator = new EngineOrchestrator();
  
  const riskEngine = new RiskEngine();
  orchestrator.registerEngine('RiskEngine', riskEngine);
  
  const robotId = 'RobotSmoke';
  const config: RiskConfig = {
    symbol: 'BTCUSDT',
    accountBalance: 10000,
    riskPercent: 0.01,
    maxAllocationPercent: 0.20,
    leverage: 1
  };
  
  riskEngine.registerRobotConfig(robotId, config);

  await orchestrator.startAll();

  let tradePlanReceived = false;
  
  coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e: any) => {
    console.log('\n[SMOKE TEST] Received TRADE_PLAN_EVENT!');
    console.log(JSON.stringify(e, null, 2));
    if (
      e.symbol === 'BTCUSDT' &&
      e.stopLoss === 90 &&
      e.takeProfit === 100 &&
      e.positionSize === 20 &&
      e.trace.correlationId === 'corr-22'
    ) {
      console.log('=> TRADE_PLAN matches expected Risk calculation!');
      tradePlanReceived = true;
    } else {
      console.error('=> TRADE_PLAN mismatch!');
    }
  });

  // 1. Fire original signal at Candle #22
  console.log('\n[SMOKE TEST] Publishing original STRATEGY_SIGNAL_EVENT at #22');
  const signal = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, EventFactory.createTrace('corr-22', 'candle-22', 'StrategyEngine', 22), {
    direction: 'LONG',
    maxTimeoutCandles: 3,
    strategyId: 'BB_Strategy',
    strategyVersion: 'v1.0.0',
    indicatorReference: {
      name: 'BB_MB',
      config: { length: 20 },
      snapshot: { line1: 110, line2: 109, line3: 100, line4: 91, line5: 90 }
    }
  });
  await coreEventBus.publish(signal as any);

  // 2. Fire ready to enter at Candle #23 (Trigger Price = 95)
  console.log('[SMOKE TEST] Publishing STATE_TRANSITION_EVENT (READY_TO_ENTER) at #23');
  const transition = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, EventFactory.createTrace('corr-22', 'candle-23', 'StateMachineEngine', 23), {
    previousState: RobotState.WAIT_RETRACEMENT,
    newState: RobotState.READY_TO_ENTER,
    reason: 'TRIGGER_MATCHED',
    triggerPrice: 95
  });
  await coreEventBus.publish(transition as any);

  console.log('[SMOKE TEST] Waiting for idle...');
  await coreEventBus.waitForIdle(robotId);

  await orchestrator.stopAll();

  if (tradePlanReceived) {
    console.log('\n--- PHASE 4 SMOKE TEST PASSED ---');
    process.exit(0);
  } else {
    console.error('\n--- PHASE 4 SMOKE TEST FAILED ---');
    process.exit(1);
  }
}

runPhase4SmokeTest().catch(console.error);
