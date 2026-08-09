import { NextRequest, NextResponse } from 'next/server';
import { TradingViewAdapter } from '@/core/adapters/tradingview/TradingViewAdapter';
import { StrategyEngine } from '@/core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '@/core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '@/core/engine/risk/RiskEngine';
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

let initialized = false;
const strategyEngine = new StrategyEngine();
const stateMachineEngine = new StateMachineEngine();
const riskEngine = new RiskEngine();

// SERVERLESS STATE WARNING: 
// POC sequence is process-local and is NOT production distributed sequencing.
// Core runtime state persistence across independent Vercel invocations is OUT OF SCOPE for this REAL DATA FIDELITY POC.
async function ensureInitialized(robotId: string) {
    if (initialized) return;
    await strategyEngine.initialize();
    await stateMachineEngine.initialize();
    await riskEngine.initialize();
    
    strategyEngine.registerRobot(robotId, 'BB_Strategy', { retracementZonePercent: 20, timeoutCandles: 3 });
    stateMachineEngine.registerRobot(robotId);
    riskEngine.registerRobotConfig(robotId, { symbol: 'XAUUSD', accountBalance: 10000, riskPercent: 2, maxAllocationPercent: 50, leverage: 1 });
    
    initialized = true;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ robotId: string }> | { robotId: string } }) {
    const receivedAt = new Date().toISOString();
    
    // Resolve params for Next.js 15+ compatibility
    const resolvedParams = await params;
    const robotId = resolvedParams.robotId;
    
    let rawPayloadStr = '';
    let payload;
    try {
        rawPayloadStr = await req.text();
        payload = JSON.parse(rawPayloadStr);
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    // Tính hash để đảm bảo idempotency (Ngăn duplicate từ TradingView retries)
    // Hash tính trực tiếp từ raw JSON nhận được, trước khi mutate.
    const payloadHash = crypto.createHash('sha256').update(rawPayloadStr).digest('hex');

    await ensureInitialized(robotId);

    // Khởi tạo Adapter
    const adapter = new TradingViewAdapter();
    
    // Expected Config Load
    const expectedConfig = {
        canonicalSymbol: 'XAUUSD',
        timeframe: '1m', // Thực tế theo chart
        indicator: {
            name: 'BB_MB',
            length: 20,
            source: 'close',
            mult: 2.5,
            mult2: 1.3
        }
    };
    
    adapter.registerConfig(robotId, expectedConfig);

    // Validation Gate
    const adapterResult = await adapter.handleWebhook(payload, robotId);
    
    const correlationId = adapterResult.correlationId || null;
    let eventSequence: number | null = null;
    if (adapterResult.events && adapterResult.events.length > 0) {
        eventSequence = Math.max(...adapterResult.events.map(e => e.sequence));
    }

    const validationStatus = adapterResult.accepted ? 'PASS' : 'REJECT';
    
    // Persist Audit Log
    try {
        const supabase = getSupabaseAdmin();
        const { error: dbError } = await supabase
            .from('tradingview_webhook_logs')
            .insert({
                robot_id: robotId,
                received_at: receivedAt,
                bar_timestamp: payload.barTimestamp || 0,
                tv_symbol: payload.tvSymbol || '',
                tv_ticker_id: payload.tvTickerId || '',
                timeframe: payload.timeframe || '',
                open: payload.open || 0,
                high: payload.high || 0,
                low: payload.low || 0,
                close: payload.close || 0,
                volume: payload.volume || 0,
                indicator_length: payload.indicator?.length || null,
                indicator_source: payload.indicator?.source || null,
                indicator_mult: payload.indicator?.mult || null,
                indicator_mult2: payload.indicator?.mult2 || null,
                line1: payload.plots?.upper || null,
                line2: payload.plots?.upper2 || null,
                line3: payload.plots?.basis || null,
                line4: payload.plots?.lower2 || null,
                line5: payload.plots?.lower || null,
                validation_status: validationStatus,
                validation_errors: adapterResult.validationErrors,
                correlation_id: correlationId,
                event_sequence: eventSequence,
                payload_hash: payloadHash,
                raw_payload: payload
            });
            
        if (dbError) {
            // Duplicate Webhook detected (Idempotency Triggered)
            if (dbError.code === '23505') {
                console.log(`[REAL TV WEBHOOK] Idempotent drop: duplicate payload_hash ${payloadHash}`);
                // Trả về 200 OK để TradingView không retry nữa. KHÔNG publish events.
                return NextResponse.json({ status: 'OK', message: 'Duplicate acknowledged' }, { status: 200 });
            }
            console.error('[REAL TV WEBHOOK] DB Error:', dbError);
            throw dbError;
        }
    } catch (e: any) {
        console.error('[REAL TV WEBHOOK] Supabase Insert Error:', e);
        return NextResponse.json({ error: 'Database audit failed' }, { status: 500 });
    }

    // IF REJECT: STOP, No Core Event, HTTP 400
    if (!adapterResult.accepted) {
        return NextResponse.json({ status: 'REJECT', errors: adapterResult.validationErrors }, { status: 400 });
    }

    // IF PASS: Publish events
    if (adapterResult.events) {
        for (const evt of adapterResult.events) {
            if (evt.eventInstance) {
                await coreEventBus.publish(evt.eventInstance);
            }
        }
    }

    return NextResponse.json({ status: 'OK', events: adapterResult.events?.map(e => ({ eventType: e.eventType, sequence: e.sequence })) }, { status: 200 });
}
