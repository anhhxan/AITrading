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
  const positionAllocationPercent = configData.position_allocation_percent || configData.robots?.position_allocation_percent || configData.risk_profile?.position_allocation_percent;
  if (!positionAllocationPercent || positionAllocationPercent <= 0 || positionAllocationPercent > 100) {
    throw new Error('ROBOT_NOT_READY: Missing or invalid position allocation percent');
  }

  riskEngine.registerRobotConfig(robotId, {
    tradingViewSymbol: configData.robots.trading_view_symbol,
    executionSymbol: configData.robots.execution_symbol,
    timeframe: configData.robots.timeframe,
    accountBalance: configData.robots.paper_balance,
    positionAllocationPercent: positionAllocationPercent,
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
    const vercel_received_at = Date.now();
    // Resolve params for Next.js 15+ compatibility
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    
    // Authentication (Bearer Token)
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.TV_WEBHOOK_SECRET;
    if (!authHeader || !expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        console.error(`[Webhook Auth Failed] Expected: ${expectedSecret}, Got: ${authHeader}`);
        const authVal = authHeader ? authHeader.replace('Bearer ', '') : '';
        return NextResponse.json({ 
            error: 'Unauthorized',
            debug: {
                envExists: !!expectedSecret,
                envLength: expectedSecret ? expectedSecret.length : 0,
                authReceived: !!authHeader,
                authLength: authVal.length,
                authMatchesEnv: false
            }
        }, { status: 401 });
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
        .select('id, status, trading_enabled, execution_symbol, notification_profile')
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

        // --- DIAGNOSTICS LOGGING ---
        try {
            const { data: lastCmd } = await supabase
                .from('robot_commands')
                .select('result')
                .eq('robot_id', robot.id)
                .eq('command_type', 'TV_SIGNAL')
                .eq('status', 'SUCCEEDED')
                .neq('command_id', deterministicCommandId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            const prevClose = lastCmd?.result?.close || null;
            let longCond = 'FAIL';
            let shortCond = 'FAIL';
            let signalResult = 'WEBHOOK RECEIVED - NO SIGNAL';
            let signalReason = 'N/A';
            
            if (prevClose !== null) {
                const b5 = payload.plots.lower;
                const b4 = payload.plots.lower2;
                const b2 = payload.plots.upper2;
                const b1 = payload.plots.upper;
                const currClose = payload.close;
                
                if (prevClose >= b5 && prevClose <= b4 && currClose > b4) {
                    longCond = 'PASS';
                    signalResult = 'SIGNAL DETECTED';
                    signalReason = 'LONG condition met';
                } else if (prevClose >= b2 && prevClose <= b1 && currClose < b2) {
                    shortCond = 'PASS';
                    signalResult = 'SIGNAL DETECTED';
                    signalReason = 'SHORT condition met';
                } else {
                    signalReason = 'Conditions not met';
                }
            } else {
                signalReason = 'Waiting for previous close data';
            }
            
            const diagnostics = {
                last_webhook_at: new Date().toISOString(),
                last_bar_timestamp: payload.barTimestamp,
                last_close: payload.close,
                upper: payload.plots.upper,
                upper2: payload.plots.upper2,
                basis: payload.plots.basis,
                lower2: payload.plots.lower2,
                lower: payload.plots.lower,
                long_condition: longCond,
                short_condition: shortCond,
                last_signal_result: signalResult,
                last_signal_reason: signalReason
            };
            
            await supabase.from('robots').update({
                notification_profile: {
                    ...(robot.notification_profile || {}),
                    diagnostics
                }
            }).eq('id', robot.id);
        } catch (diagErr) {
            console.error('[DIAGNOSTICS ERROR]', diagErr);
        }
        // --- END DIAGNOSTICS ---

        const vercel_response_at = Date.now();
        console.log(`[VERCEL WEBHOOK] Processed robot ${robotId}. Total Latency: ${vercel_response_at - vercel_received_at}ms`);

        return NextResponse.json({ status: 'OK', command_id: deterministicCommandId }, { status: 200 });
    } catch (err: any) {
        console.error('[TV WEBHOOK] Execution Error:', err);
        await supabase.from('robot_commands').update({ status: 'FAILED', result: err.message }).eq('command_id', deterministicCommandId);
        
        const vercel_response_at = Date.now();
        console.log(`[VERCEL WEBHOOK] Error on robot ${robotId}. Total Latency: ${vercel_response_at - vercel_received_at}ms`);

        if (err.message && err.message.includes('ROBOT_NOT_READY')) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
