import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { StateMachineEngine } from '../core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '../core/engine/risk/RiskEngine';
import { PaperExecutionEngine } from '../core/engine/execution/PaperExecutionEngine';
import { coreEventBus } from '../core/infrastructure/EventBus';
import { EventFactory } from '../core/infrastructure/EventFactory';
import { getSupabaseAdmin } from '../lib/supabase';
import { v4 as randomUUID } from 'uuid';

async function runE2E() {
  console.log('Starting Phase 14H E2E Local Trace...');
  
  const supabase = getSupabaseAdmin();
  const robotId = randomUUID();
  
  console.log(`Using Ephemeral Robot ID: ${robotId}`);

  // 1. Setup DB for Robot
  await supabase.from('robots').insert({
    id: robotId,
    name: 'Phase 14H E2E Test',
    trading_type: 'PAPER',
    status: 'ACTIVE',
    current_state: 'WAIT_SIGNAL'
  });

  await supabase.from('robot_configs').insert({
    robot_id: robotId,
    version: 1,
    base_asset: 'BTC',
    quote_asset: 'USDT',
    risk_per_trade: 2,
    max_leverage: 10,
    daily_loss_limit: 10,
    status: 'ACTIVE'
  });

  // 2. Initialize Engines
  const stateMachine = new StateMachineEngine();
  const riskEngine = new RiskEngine();
  const execEngine = new PaperExecutionEngine();

  await stateMachine.initialize();
  await riskEngine.initialize();
  await execEngine.initialize();

  stateMachine.registerRobot(robotId);
  riskEngine.registerRobotConfig(robotId, {
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    executionSymbol: 'BTCUSDT',
    timeframe: '1m',
    accountBalance: 10000,
    positionAllocationPercent: 2,
    leverage: 10
  });

  // 3. E2E Traces
  let globalSeq = 1;
  const runTrace = async (name: string, dir: string, lower: number, upper: number, open: number, high: number, low: number, close: number, expectedFill: number) => {
    console.log(`\n===========================================`);
    console.log(`Running Trace: ${name}`);
    console.log(`===========================================`);
    
    // Reset state
    await supabase.from('robots').update({ current_state: 'WAIT_SIGNAL' }).eq('id', robotId);
    stateMachine.registerRobot(robotId);

    // Send Signal
    const corrId = randomUUID();
    const trace = EventFactory.createTrace(corrId, 'parent-1', 'tester', globalSeq++);
    const signalEvent = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
      direction: dir,
      entryTrigger: { type: 'RETRACEMENT_ZONE', lower, upper },
      indicatorReference: { snapshot: { line1: 64020, line3: 63800, line5: 63500 } }
    });
    
    await coreEventBus.publish(signalEvent as any);
    await coreEventBus.waitForIdle(robotId);

    // Send Candle
    const cTrace = EventFactory.createTrace(corrId, 'parent-2', 'tester', globalSeq++);
    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, cTrace, {
      candle: { open, high, low, close, volume: 100, timestamp: Date.now() }
    });
    
    await coreEventBus.publish(candleEvent as any);
    await coreEventBus.waitForIdle(robotId);

    // Wait extra time for PaperExecutionEngine to process intents
    await new Promise(r => setTimeout(r, 3000));

    // Verify DB
    const { data: transitions } = await supabase.from('core_events')
      .select('payload').eq('correlation_id', corrId).eq('event_type', 'STATE_TRANSITION_EVENT').eq('payload->>newState', 'READY_TO_ENTER');
    
    const { data: intents } = await supabase.from('execution_intents').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1);
    const { data: positions } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).order('created_at', { ascending: false }).limit(1);

    const triggerPrice = transitions?.[0]?.payload?.triggerPrice;
    console.log(`StateMachine Trigger Price: ${triggerPrice}`);
    console.log(`Expected Fill Price: ${expectedFill}`);
    
    if (intents && intents.length > 0) {
      console.log(`Execution Intent [${intents[0].id}]: order_type=${intents[0].order_type}, price=${intents[0].price}`);
    } else {
      console.log(`Execution Intent: NONE (Failed)`);
    }

    if (positions && positions.length > 0) {
      console.log(`Active Position [${positions[0].id}]: entry_price=${positions[0].entry_price}`);
    } else {
      console.log(`Active Position: NONE (Failed)`);
    }
  };

  // Run the 4 E2E cases
  await runTrace('LONG Normal', 'LONG', 64000, 64020, 64050, 64080, 64010, 64050, 64020);
  await runTrace('LONG Open Inside', 'LONG', 64000, 64020, 64010, 64015, 64005, 64010, 64010);
  await runTrace('SHORT Normal', 'SHORT', 64000, 64020, 63900, 64010, 63850, 63900, 64000);
  await runTrace('SHORT Open Inside', 'SHORT', 64000, 64020, 64010, 64015, 63990, 64010, 64010);

  console.log('\nCleaning up E2E data...');
  await supabase.from('robots').delete().eq('id', robotId);
  
  process.exit(0);
}

runE2E().catch(console.error);
