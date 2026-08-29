import { randomUUID } from 'crypto';
import { EventFactory } from '../../infrastructure/EventFactory';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { SequenceAuthority } from '../../infrastructure/SequenceAuthority';
import { SetupManager } from '../../engine/runtime/SetupManager';

export interface SignalWebhookPayload {
    signalId?: string;
    direction: 'LONG' | 'SHORT';
    symbol: string;
    timeframe: string;
    barTimestamp: number;
    bands: {
        B1: number;
        B2: number;
        B3: number;
        B4: number;
        B5: number;
    };
    isTest?: boolean;
    testId?: string;
    event?: 'PENDING' | 'ARM' | 'FIRE' | 'CANCEL' | 'STOP';
    trigger?: number;
    stop?: number;
    setup_id?: string;
    eventTimestamp?: number;
}

export interface AdapterResult {
    accepted: boolean;
    validationErrors: string[];
    correlationId?: string;
    events?: any[];
}

export class TradingViewSignalAdapter {
    

    private canonicalizeTimeframe(tvTimeframe: string): string {
        if (tvTimeframe === '1') return '1m';
        if (tvTimeframe === '5') return '5m';
        if (tvTimeframe === '15') return '15m';
        if (tvTimeframe === '30') return '30m';
        if (tvTimeframe === '45') return '45m';
        if (tvTimeframe === '60') return '1H';
        if (tvTimeframe === '120') return '2H';
        if (tvTimeframe === '180') return '3H';
        if (tvTimeframe === '240') return '4H';
        if (tvTimeframe === 'D' || tvTimeframe === '1D') return '1D';
        return tvTimeframe;
    }

    public async handleWebhook(payload: SignalWebhookPayload, robotId: string, correlationId?: string): Promise<AdapterResult> {
        correlationId = correlationId || `tv_sig_${Date.now()}`;
        
        let activeVersion = 1;
        let expectedCanonicalSymbol = '';
        let expectedTimeframe = '';
        let expectedRetracementZonePercent = 10; // default 10%
        let expectedMaxTimeoutCandles = 3;

        try {
            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase
                .from('robot_configs')
                .select('id, version, strategy_profile, robots!inner(trading_view_symbol, timeframe)')
                .eq('robot_id', robotId)
                .eq('status', 'ACTIVE')
                .single();

            if (error || !data) {
                console.error(`[TradingViewSignalAdapter] REJECT: No ACTIVE config found in DB for robot ${robotId}`, error);
                return { accepted: false, validationErrors: ['MISSING_CONFIG'] };
            }

            activeVersion = data.version;
            expectedCanonicalSymbol = data.robots.trading_view_symbol;
            expectedTimeframe = data.robots.timeframe;
            
            if (data.strategy_profile?.retracementZonePercent !== undefined) {
                expectedRetracementZonePercent = data.strategy_profile.retracementZonePercent;
            }
            if (data.strategy_profile?.timeoutCandles !== undefined) {
                expectedMaxTimeoutCandles = data.strategy_profile.timeoutCandles;
            }
        } catch (e) {
            console.error(`[TradingViewSignalAdapter] DB ERROR:`, e);
            return { accepted: false, validationErrors: ['DB_ERROR'] };
        }

        // VALIDATION GATE
        const canonicalTF = this.canonicalizeTimeframe(payload.timeframe);
        const validationErrors: string[] = [];

        if (payload.symbol !== expectedCanonicalSymbol) validationErrors.push('Symbol mismatch');
        if (canonicalTF.toLowerCase() !== expectedTimeframe.toLowerCase()) validationErrors.push('Timeframe mismatch');
        if (payload.direction !== 'LONG' && payload.direction !== 'SHORT') validationErrors.push('Invalid direction');
        if (!payload.bands || typeof payload.bands.B3 !== 'number') validationErrors.push('Missing bands');

        if (validationErrors.length > 0) {
            console.error(`[TradingViewSignalAdapter] VALIDATION REJECTED:`, validationErrors);
            return { accepted: false, validationErrors };
        }

        const tvEvent = payload.event || 'PENDING';
        const setup_id = payload.setup_id || ('tv_' + payload.barTimestamp);
        
        const setupPayload = {
            setup_id,
            event: tvEvent,
            direction: payload.direction,
            trigger: payload.trigger,
            stop: payload.stop,
            eventTimestamp: payload.eventTimestamp || Date.now(),
            snapshot: {
                line1: payload.bands.B1,
                line2: payload.bands.B2,
                line3: payload.bands.B3,
                line4: payload.bands.B4,
                line5: payload.bands.B5
            }
        };

        const setupResult = await SetupManager.handleSetupEvent(robotId, setupPayload);
        
        if (!setupResult.success) {
            console.error('[TradingViewSignalAdapter] SetupManager rejected:', setupResult.error);
            return { accepted: false, validationErrors: [setupResult.error || 'SETUP_REJECTED'] };
        }

        const events = [];

        if (tvEvent === 'FIRE') {
            let seq = SequenceAuthority.next(robotId);
            const trace = EventFactory.createTrace(correlationId, 'webhook-' + randomUUID(), 'TradingViewSignalAdapter', seq);
            const tradePlan = EventFactory.createEvent('TRADE_PLAN_EVENT', robotId, activeVersion, trace, {
                strategyId: 'TV_SIGNAL',
                strategyVersion: 1,
                tradingViewSymbol: payload.symbol,
                executionSymbol: expectedCanonicalSymbol, 
                direction: payload.direction,
                signalId: setup_id,
                entryTrigger: payload.trigger,
                stopLoss: payload.stop,
                takeProfit: null,
                positionAllocationPercent: 10,
                positionSize: 0.1,
                leverage: 1,
                entryReferencePrice: payload.trigger
            });
            events.push({
                eventType: 'TRADE_PLAN_EVENT',
                eventId: tradePlan.eventId,
                sequence: tradePlan.trace.sequence,
                eventInstance: tradePlan
            });
            console.log(`[TradingViewSignalAdapter] Validation PASS. Generated TRADE_PLAN_EVENT for ${robotId}.`);
        } else if (tvEvent === 'STOP' || tvEvent === 'CANCEL') {
            let seq = SequenceAuthority.next(robotId);
            const trace = EventFactory.createTrace(correlationId, 'webhook-' + randomUUID(), 'TradingViewSignalAdapter', seq);
            const tradePlanClose = EventFactory.createEvent('TRADE_PLAN_EVENT', robotId, activeVersion, trace, {
                action: 'CLOSE',
                strategyId: 'TV_SIGNAL',
                strategyVersion: 1,
                tradingViewSymbol: payload.symbol,
                executionSymbol: expectedCanonicalSymbol, 
                direction: payload.direction,
                signalId: setup_id,
                entryTrigger: payload.stop,
                stopLoss: null,
                takeProfit: null,
                positionAllocationPercent: 10,
                positionSize: 0.1,
                leverage: 1,
                entryReferencePrice: payload.stop || 0,
                closeReason: tvEvent === 'STOP' ? 'STOP_LOSS' : 'CANCELLED'
            } as any);
            events.push({
                eventType: 'TRADE_PLAN_EVENT',
                eventId: tradePlanClose.eventId,
                sequence: tradePlanClose.trace.sequence,
                eventInstance: tradePlanClose
            });
            console.log(`[TradingViewSignalAdapter] Validation PASS. Generated TRADE_PLAN_EVENT (CLOSE) for ${robotId}.`);
        } else {
            console.log(`[TradingViewSignalAdapter] Validation PASS. State updated via SetupManager (${tvEvent}) for ${robotId}. No execution event emitted.`);
        }

        return {
            accepted: true,
            validationErrors: [],
            correlationId,
            events
        };
    }
}

