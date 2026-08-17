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
  
  // 1. Fetch Active Config and Robot State
  const { data: configData, error: configErr } = await supabase
    .from('robot_configs')
    .select('*, robots!inner(*)')
    .eq('robot_id', robotId)
    .eq('status', 'ACTIVE')
    .single();
    
  if (configErr || !configData) throw new Error('MISSING_CONFIG');
  
  const currentState = configData.robots.current_state || 'WAIT_SIGNAL';

  // Register Robot to Engines if not already registered (for memory persistence)
  if (!(strategyEngine as any).robotConfig.has(robotId)) {
    strategyEngine.registerRobot(robotId, 'BB_Strategy', {});
  }
  
  // FORCE stateMachine to align with DB state
  (stateMachine as any).states.set(robotId, currentState);

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
  }

  // Rehydrate Active Signal from core_events if state requires it
  if (currentState === 'WAIT_RETRACEMENT' || currentState === 'READY_TO_ENTER') {
      const { data: signalEvent } = await supabase
          .from('core_events')
          .select('payload, timestamp')
          .eq('robot_id', robotId)
          .eq('event_type', 'STRATEGY_SIGNAL_EVENT')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
      if (signalEvent && signalEvent.payload) {
          const activeSignal = signalEvent.payload;
          (stateMachine as any).activeSignals.set(robotId, activeSignal);
          (riskEngine as any).activeSignals.set(robotId, activeSignal);
          
          // Rehydrate timeout count by counting CANDLE_CLOSED events since the signal
          const { count } = await supabase
              .from('core_events')
              .select('*', { count: 'exact', head: true })
              .eq('robot_id', robotId)
              .eq('event_type', 'CANDLE_CLOSED')
              .gt('timestamp', signalEvent.timestamp);
              
          (stateMachine as any).timeoutCounts.set(robotId, count || 0);
          console.log(`[rehydrateContext] Rehydrated signal and state ${currentState} for ${robotId}. Timeout count: ${count || 0}`);
      } else {
          console.warn(`[rehydrateContext] Robot is in ${currentState} but no STRATEGY_SIGNAL_EVENT found.`);
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

        // FIX 1: Normalize numeric timestamp correctly
        if (payload.barTimestamp) {
            const ts = Number(payload.barTimestamp);
            if (!Number.isFinite(ts)) {
                throw new Error("INVALID_BAR_TIMESTAMP");
            }
            payload.barTimestamp = ts;
        }
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();

    // Verify robot exists and is RUNNING
    const { data: robot, error: robotError } = await supabase
        .from('robots')
        .select('id, status, trading_enabled, execution_symbol, notification_profile, trading_mode, trading_account_id')
        .eq('id', robotId)
        .single();
        
    if (robotError || !robot) {
        return NextResponse.json({ error: 'ROBOT_NOT_FOUND' }, { status: 404 });
    }

    if (robot.status !== 'RUNNING') {
        return NextResponse.json({ error: 'ROBOT_NOT_RUNNING' }, { status: 400 });
    }

    if (robot.trading_mode === 'LIVE' && !robot.trading_account_id) {
        return NextResponse.json({ error: 'LIVE_MODE_REQUIRES_TRADING_ACCOUNT' }, { status: 400 });
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
        
        // FIX 2: Fetch previous payload from persistent source (robot_commands)
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
        
        const previousPayload = lastCmd?.result || null;
        payload.previousPayload = previousPayload; // Pass down to adapter

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
            let signalResult = 'WEBHOOK RECEIVED - NO SIGNAL';
            let signalReason = 'N/A';
            let diagnostics: any = {
                last_webhook_at: new Date().toISOString(),
                last_bar_timestamp: payload.barTimestamp,
                last_signal_result: signalResult,
                last_signal_reason: signalReason
            };
            
            if (previousPayload !== null && previousPayload.plots) {
                const prevB5 = previousPayload.plots.lower;
                const prevB4 = previousPayload.plots.lower2;
                const prevB3 = previousPayload.plots.basis;
                const prevB2 = previousPayload.plots.upper2;
                const prevB1 = previousPayload.plots.upper;
                const prevClose = previousPayload.close;
                
                const currB5 = payload.plots.lower;
                const currB4 = payload.plots.lower2;
                const currB3 = payload.plots.basis;
                const currB2 = payload.plots.upper2;
                const currB1 = payload.plots.upper;
                const currClose = payload.close;
                
                // LONG Condition
                const longC1 = prevClose >= prevB5;
                const longC2 = prevClose <= prevB4;
                const longC3 = currClose > currB4;
                const longFinal = longC1 && longC2 && longC3;
                
                // SHORT Condition
                const shortC1 = prevClose >= prevB2;
                const shortC2 = prevClose <= prevB1;
                const shortC3 = currClose < currB2;
                const shortFinal = shortC1 && shortC2 && shortC3;
                
                if (longFinal) {
                    signalResult = 'SIGNAL DETECTED';
                    signalReason = 'LONG condition met';
                } else if (shortFinal) {
                    signalResult = 'SIGNAL DETECTED';
                    signalReason = 'SHORT condition met';
                } else {
                    signalReason = 'Conditions not met';
                }
                
                diagnostics = {
                    last_webhook_at: new Date().toISOString(),
                    last_bar_timestamp: payload.barTimestamp,
                    last_signal_result: signalResult,
                    last_signal_reason: signalReason,
                    
                    prev_snapshot: {
                        close: prevClose,
                        b1: prevB1, b2: prevB2, b3: prevB3, b4: prevB4, b5: prevB5
                    },
                    curr_snapshot: {
                        close: currClose,
                        b1: currB1, b2: currB2, b3: currB3, b4: currB4, b5: currB5
                    },
                    logic_eval: {
                        long_c1: longC1,
                        long_c2: longC2,
                        long_c3: longC3,
                        long_final: longFinal,
                        short_c1: shortC1,
                        short_c2: shortC2,
                        short_c3: shortC3,
                        short_final: shortFinal
                    }
                };
            } else {
                diagnostics.last_signal_reason = 'Waiting for previous close data';
            }
            
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
