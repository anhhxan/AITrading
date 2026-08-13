'use server';

import { getSupabaseAdmin } from '../../lib/supabase';
import { EventFactory } from '../../core/infrastructure/EventFactory';
import { coreEventBus } from '../../core/infrastructure/EventBus';
import { PaperExecutionEngine } from '../../core/engine/execution/PaperExecutionEngine';
import { PaperPositionTracker } from '../../core/engine/execution/PaperPositionTracker';
import { calculateRiskPreview } from '../../core/engine/risk/RiskCalculator';
import { IndicatorEngine } from '../../core/engine/indicators/IndicatorEngine';
import { StrategyEngine } from '../../core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '../../core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '../../core/engine/risk/RiskEngine';

export async function getOrCreateSimulatorRobot(userId: string, startingBalance: number) {
  const supabase = getSupabaseAdmin();
  const slug = `quick-paper-simulator-${userId}`;

  let { data: robot } = await supabase
    .from('robots')
    .select('id, paper_balance')
    .eq('slug', slug)
    .single();

  if (!robot) {
    const { data: newRobot, error } = await supabase
      .from('robots')
      .insert({
        user_id: userId,
        name: 'Quick Paper Simulator',
        slug: slug,
        trading_mode: 'PAPER',
        trading_enabled: false, // simulator-safe
        status: 'RUNNING',
        current_state: 'WAIT_SIGNAL',
        timeframe: '15m',
        signal_source: 'TRADINGVIEW',
        trading_view_symbol: 'BINANCE:BTCUSDT', // Placeholder
        execution_symbol: 'BTCUSDT',
        provider: 'BINANCE',
        trading_session: '24/7',
        paper_balance: startingBalance
      })
      .select('id, paper_balance')
      .single();

    if (error) throw new Error('Failed to create simulator robot: ' + error.message);
    robot = newRobot;
  } else {
    // Optionally reset balance if requested or if we want to ensure it matches
    // But usually we don't reset unless user clicks reset.
  }

  return robot;
}

export async function openSimulatorTrade(params: {
  userId: string;
  robotId: string;
  symbol: string;
  tradingViewSymbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  balance: number;
  riskPercent: number; // For % Risk
  allocationPercent: number; // For % Balance
  sizingMode: 'RISK' | 'ALLOCATION' | 'FIXED';
  fixedQuantity?: number;
}) {
  const { robotId, symbol, direction, entryPrice, stopLoss, takeProfit, balance, sizingMode, riskPercent, allocationPercent, fixedQuantity } = params;

  // Re-use RiskCalculator for safety and consistency
  const riskResult = calculateRiskPreview({
    accountBalance: balance,
    direction,
    entryReferencePrice: entryPrice,
    stopLoss,
    takeProfit,
    riskPercent: sizingMode === 'RISK' ? (riskPercent / 100) : 0.01, // Dummy if not risk
    maxAllocationPercent: sizingMode === 'ALLOCATION' ? (allocationPercent / 100) : 1, // 100% cap
    leverage: 1
  });

  if (sizingMode === 'RISK' && riskResult.decision === 'RISK_REJECTED') {
    throw new Error('Risk Calculator Rejected: ' + riskResult.reason);
  }

  let finalQuantity = 0;
  if (sizingMode === 'FIXED') {
    finalQuantity = fixedQuantity || 0;
  } else if (sizingMode === 'ALLOCATION') {
    finalQuantity = (balance * (allocationPercent / 100)) / entryPrice;
  } else {
    finalQuantity = riskResult.positionSize;
  }

  if (finalQuantity <= 0) throw new Error('Invalid Quantity');

  // We need to inject the event into the execution engine
  const engine = new PaperExecutionEngine();
  await engine.initialize();

  const correlationId = crypto.randomUUID();
  const trace = EventFactory.createTrace(correlationId, 'manual', 'ui', 1);
  const tradePlanEvent = EventFactory.createEvent('TRADE_PLAN_EVENT', robotId, 1, trace, {
    strategyId: 'simulator',
    strategyVersion: 'v1',
    symbol: symbol,
    direction: direction,
    triggerPrice: entryPrice,
    entryReferencePrice: entryPrice,
    stopLoss: stopLoss,
    takeProfit: takeProfit,
    accountBalance: balance,
    riskPercent: sizingMode === 'RISK' ? (riskPercent / 100) : 0,
    riskAmount: sizingMode === 'RISK' ? riskResult.riskAmount : 0,
    maxAllocationPercent: sizingMode === 'ALLOCATION' ? (allocationPercent / 100) : 1,
    positionSize: finalQuantity,
    leverage: 1,
    riskRewardRatio: riskResult.riskRewardRatio,
    indicatorReference: { name: 'simulator', config: {}, snapshot: {} }
  });

  try {
    await coreEventBus.publish(tradePlanEvent as any);
    await coreEventBus.waitForIdle(robotId);
  } finally {
    await engine.shutdown();
  }
}

export async function sendSimulatedCandle(params: {
  robotId: string;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
}) {
  const { robotId, symbol, open, high, low, close } = params;

  const tracker = new PaperPositionTracker();
  await tracker.initialize();

  const correlationId = crypto.randomUUID();
  const trace = EventFactory.createTrace(correlationId, 'manual', 'ui', 2);
  const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, trace, {
    candle: {
      open, high, low, close,
      timestamp: Date.now(),
      volume: 100
    },
    symbol // Adding symbol if needed by tracker
  });

  try {
    await coreEventBus.publish(candleEvent as any);
    await coreEventBus.waitForIdle(robotId);
  } finally {
    await tracker.shutdown();
  }
}

export async function resetSimulator(userId: string, startingBalance: number = 10000) {
  const supabase = getSupabaseAdmin();
  const slug = `quick-paper-simulator-${userId}`;

  const { data: robot } = await supabase.from('robots').select('id').eq('slug', slug).single();
  if (!robot) return;

  await supabase.from('trade_history').delete().eq('robot_id', robot.id);
  await supabase.from('active_positions').delete().eq('robot_id', robot.id);
  await supabase.from('active_orders').delete().eq('robot_id', robot.id);
  await supabase.from('execution_intents').delete().eq('robot_id', robot.id);
  
  await supabase.from('robots').update({ paper_balance: startingBalance, current_state: 'WAIT_SIGNAL' }).eq('id', robot.id);
}

export async function playCandleSequence(params: {
  robotId: string;
  symbol: string;
  timeframe: string;
  candles: { open: number, high: number, low: number, close: number }[];
  balance: number;
  riskPercent: number;
  maxAllocationPercent: number;
  leverage: number;
}) {
  const { robotId, symbol, candles, balance, riskPercent, maxAllocationPercent, leverage } = params;

  if (candles.length === 0) return;

  const indicatorEngine = new IndicatorEngine();
  const strategyEngine = new StrategyEngine();
  const stateMachine = new StateMachineEngine();
  const riskEngine = new RiskEngine();
  const executionEngine = new PaperExecutionEngine();
  const positionTracker = new PaperPositionTracker();

  // Initialize all
  await indicatorEngine.initialize();
  await strategyEngine.initialize();
  await stateMachine.initialize();
  await riskEngine.initialize();
  await executionEngine.initialize();
  await positionTracker.initialize();

  // Register configs
  indicatorEngine.registerRobot(robotId, [{ name: 'BB_MB', params: { period: 20, stdDev: 2 } }]);
  strategyEngine.registerRobot(robotId, 'BB_Strategy', {});
  stateMachine.registerRobot(robotId);
  riskEngine.registerRobotConfig(robotId, {
    symbol,
    accountBalance: balance,
    riskPercent: riskPercent / 100,
    maxAllocationPercent: maxAllocationPercent / 100,
    leverage
  });

  // Generate Warmup Candles (20 alternating candles to create variance)
  const firstOpen = candles[0].open;
  const warmupCandles = Array.from({ length: 20 }).map((_, i) => {
    const val = firstOpen + (i % 2 === 0 ? 10 : -10);
    return {
      open: val,
      high: val,
      low: val,
      close: val,
      timestamp: Date.now() - (1000 * 60 * 60 * 24) + i * 1000 * 60 * 15,
      volume: 100
    };
  });

  indicatorEngine.warmupRobot(robotId, warmupCandles);

  try {
    const traceId = crypto.randomUUID();
    let seq = 1;

    for (const c of candles) {
      const trace = EventFactory.createTrace(traceId, 'manual', 'ui', seq++);
      const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, trace, {
        candle: {
          ...c,
          timestamp: Date.now() + seq * 1000 * 60 * 15,
          volume: 100
        },
        symbol
      });

      await coreEventBus.publish(candleEvent as any);
      await coreEventBus.waitForIdle(robotId);
    }
  } finally {
    await indicatorEngine.shutdown();
    await strategyEngine.shutdown();
    await stateMachine.shutdown();
    await riskEngine.shutdown();
    await executionEngine.shutdown();
    await positionTracker.shutdown();
  }
}

export async function closeSimulatorTrade(robotId: string, currentPrice: number) {
  const supabase = getSupabaseAdmin();
  
  const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).single();
  if (!pos) throw new Error('No active position');

  const pnl = pos.side === 'LONG' 
    ? (currentPrice - pos.entry_price) * pos.quantity 
    : (pos.entry_price - currentPrice) * pos.quantity;

  const { data: robot } = await supabase.from('robots').select('paper_balance').eq('id', robotId).single();
  const newBalance = (robot?.paper_balance || 0) + pnl;

  await supabase.from('trade_history').insert({
    robot_id: robotId,
    symbol: pos.symbol,
    action: pos.side === 'LONG' ? 'SELL' : 'BUY',
    quantity: pos.quantity,
    entry_price: pos.entry_price,
    exit_price: currentPrice,
    pnl: pnl,
    reason: 'MANUAL',
    strategy_id: pos.strategy_id
  });

  await supabase.from('active_positions').delete().eq('id', pos.id);
  await supabase.from('robots').update({ paper_balance: newBalance, current_state: 'WAIT_SIGNAL' }).eq('id', robotId);
}

