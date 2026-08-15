import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';
import { EngineOrchestrator } from '@/core/engine/runtime/EngineOrchestrator';
import { StrategyEngine } from '@/core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '@/core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '@/core/engine/risk/RiskEngine';
import { PaperExecutionEngine } from '@/core/engine/execution/PaperExecutionEngine';
import { PaperPositionTracker } from '@/core/engine/execution/PaperPositionTracker';
import { TradingViewAdapter } from '@/core/adapters/tradingview/TradingViewAdapter';
import { coreEventBus } from '@/core/infrastructure/EventBus';

// Globals to preserve state across invocations in development (hot reload)
// In production Vercel, this will be instantiated per cold start.
let orchestrator: EngineOrchestrator | null = null;
let adapter: TradingViewAdapter | null = null;
let strategyEngine: StrategyEngine;
let stateMachine: StateMachineEngine;
let riskEngine: RiskEngine;
let executionEngine: PaperExecutionEngine;
let positionTracker: PaperPositionTracker;

async function initEngines() {
  if (orchestrator) return;
  
  orchestrator = new EngineOrchestrator();
  adapter = new TradingViewAdapter();
  
  strategyEngine = new StrategyEngine();
  stateMachine = new StateMachineEngine();
  riskEngine = new RiskEngine();
  executionEngine = new PaperExecutionEngine();
  positionTracker = new PaperPositionTracker();

  await strategyEngine.initialize();
  await stateMachine.initialize();
  await riskEngine.initialize();
  await executionEngine.initialize();
  await positionTracker.initialize();
}

async function rehydrateContext(robotId: string) {
  const supabase = getSupabaseAdmin();
  
  // 1. Fetch Active Config
  const { data: configData, error: configErr } = await supabase
    .from('robot_configs')
    .select('*, robots!inner(*)')
    .eq('robot_id', robotId)
    .eq('status', 'ACTIVE')
    .single();
    
  if (configErr || !configData) throw new Error('MISSING_CONFIG');
  
  // Register Robot to Engines if not already registered (for memory persistence)
  if (!(strategyEngine as any).robotConfig.has(robotId)) {
    strategyEngine.registerRobot(robotId, 'BB_Strategy', {});
  }
  if (!(stateMachine as any).states.has(robotId)) {
    stateMachine.registerRobot(robotId);
  }
  riskEngine.registerRobotConfig(robotId, {
    tradingViewSymbol: configData.robots.trading_view_symbol,
    executionSymbol: configData.robots.execution_symbol,
    timeframe: configData.robots.timeframe,
    accountBalance: configData.robots.paper_balance,
    riskPercent: configData.robots.risk_percent || 1,
    maxAllocationPercent: configData.robots.max_allocation_percent || 100,
    leverage: configData.robots.leverage || 1
  });

  // Rehydrate position contexts if active position exists
  const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', robotId).single();
  
  if (pos && pos.context_snapshot) {
    if (!(positionTracker as any).positionContexts.has(robotId)) {
      (positionTracker as any).positionContexts.set(robotId, pos.context_snapshot);
    }
    if (!(stateMachine as any).states.has(robotId) || (stateMachine as any).states.get(robotId) === 'IDLE') {
      (stateMachine as any).states.set(robotId, 'POSITION_OPEN');
    }
  } else {
    // Check if waiting for entry
    const { data: intent } = await supabase.from('execution_intents').select('*').eq('robot_id', robotId).eq('status', 'PENDING').single();
    if (intent) {
      if (!(stateMachine as any).states.has(robotId) || (stateMachine as any).states.get(robotId) === 'IDLE') {
        (stateMachine as any).states.set(robotId, 'READY_TO_ENTER'); // Or WAIT_RETRACEMENT, but let's just say READY_TO_ENTER because we don't know
        (stateMachine as any).activeSignals.set(robotId, { direction: intent.action });
      }
    }
  }
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    const authVal = authHeader ? authHeader.replace('Bearer ', '') : '';

    return NextResponse.json({
        envExists: !!expectedSecret,
        envLength: expectedSecret ? expectedSecret.length : 0,
        authReceived: !!authHeader,
        authLength: authVal.length,
        authMatchesEnv: expectedSecret && authVal === expectedSecret
    }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    // Resolve params for Next.js 15+ compatibility
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    
    // Authentication (Bearer Token)
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        console.error(`[Webhook Auth Failed] Expected: ${expectedSecret}, Got: ${authHeader}`);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let payload;
    try {
        const rawPayloadStr = await req.text();
        payload = JSON.parse(rawPayloadStr);
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();

    // Verify robot exists and is RUNNING
    const { data: robot, error: robotError } = await supabase
        .from('robots')
        .select('id, status, trading_enabled, execution_symbol')
        .eq('id', robotId)
        .single();
        
    if (robotError || !robot) {
        return NextResponse.json({ error: 'ROBOT_NOT_FOUND' }, { status: 404 });
    }

    if (robot.status !== 'RUNNING') {
        return NextResponse.json({ error: 'ROBOT_NOT_RUNNING' }, { status: 400 });
    }

    // Deterministic Idempotency Check
    const payloadStr = JSON.stringify(payload);
    const hash = crypto.createHash('md5').update(payloadStr).digest('hex');
    const deterministicCommandId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;

    // Ensure processing idempotency
    const { error: cmdError } = await supabase.from('robot_commands').insert({
        robot_id: robot.id,
        command_id: deterministicCommandId,
        command_type: 'TV_SIGNAL',
        status: 'PROCESSING',
        correlation_id: `tv_${hash.slice(0, 10)}_${Date.now()}`,
        result: payload 
    });

    if (cmdError && cmdError.code === '23505') {
        console.log(`[TV WEBHOOK] Idempotent drop: duplicate command_id ${deterministicCommandId}`);
        return NextResponse.json({ status: 'OK', message: 'Duplicate acknowledged' }, { status: 200 });
    }

    try {
        await initEngines();
        await rehydrateContext(robotId);
        
        // Pass to adapter which generates CANDLE_CLOSED and INDICATOR_UPDATED
        const result = await adapter!.handleWebhook(payload, robotId);
        
        if (!result.accepted) {
            await supabase.from('robot_commands').update({ status: 'FAILED', result: result.validationErrors }).eq('command_id', deterministicCommandId);
            return NextResponse.json({ error: 'Validation Failed', details: result.validationErrors }, { status: 400 });
        }

        // Publish events generated by adapter synchronously
        for (const evt of result.events || []) {
            await coreEventBus.publish(evt.eventInstance);
        }
        
        // Wait for state machine and execution to finish
        await coreEventBus.waitForIdle(robotId);
        
        await supabase.from('robot_commands').update({ status: 'SUCCEEDED' }).eq('command_id', deterministicCommandId);
        return NextResponse.json({ status: 'OK', command_id: deterministicCommandId }, { status: 200 });
    } catch (err: any) {
        console.error('[TV WEBHOOK] Execution Error:', err);
        await supabase.from('robot_commands').update({ status: 'FAILED', result: err.message }).eq('command_id', deterministicCommandId);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
