import { randomUUID } from 'crypto';
import { EventFactory } from '../../infrastructure/EventFactory';
import { getSupabaseAdmin } from '../../../lib/supabase';

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
}

export interface AdapterResult {
    accepted: boolean;
    validationErrors: string[];
    correlationId?: string;
    events?: any[];
}

export class TradingViewSignalAdapter {
    private sequences: Map<string, number> = new Map();

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

        // CALCULATE RETRACEMENT ZONE
        let entryTrigger;
        if (payload.direction === 'LONG') {
            const distance = Math.abs(payload.bands.B4 - payload.bands.B3);
            const zoneValue = distance * (expectedRetracementZonePercent / 100);
            entryTrigger = {
                type: 'RETRACEMENT_ZONE',
                lower: payload.bands.B4 - zoneValue,
                upper: payload.bands.B4
            };
        } else if (payload.direction === 'SHORT') {
            const distance = Math.abs(payload.bands.B3 - payload.bands.B2);
            const zoneValue = distance * (expectedRetracementZonePercent / 100);
            entryTrigger = {
                type: 'RETRACEMENT_ZONE',
                lower: payload.bands.B2,
                upper: payload.bands.B2 + zoneValue
            };
        }

        let seq = this.sequences.get(robotId) || 1;
        const trace = EventFactory.createTrace(correlationId, 'webhook-' + randomUUID(), 'TradingViewSignalAdapter', seq++);
        this.sequences.set(robotId, seq);

        // CREATE STRATEGY_SIGNAL_EVENT directly
        const signalEvent = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, activeVersion, trace, {
            strategyId: 'TV_SIGNAL',
            direction: payload.direction,
            entryTrigger,
            maxTimeoutCandles: expectedMaxTimeoutCandles,
            barTimestamp: payload.barTimestamp,
            indicatorReference: {
                snapshot: {
                    line1: payload.bands.B1,
                    line2: payload.bands.B2,
                    line3: payload.bands.B3,
                    line4: payload.bands.B4,
                    line5: payload.bands.B5
                },
                source: 'TRADING_VIEW_WEBHOOK'
            }
        });

        console.log(`[TradingViewSignalAdapter] Validation PASS. Generated STRATEGY_SIGNAL_EVENT for ${robotId}.`);

        return {
            accepted: true,
            validationErrors: [],
            correlationId,
            events: [
                {
                    eventType: 'STRATEGY_SIGNAL_EVENT',
                    eventId: signalEvent.eventId,
                    sequence: signalEvent.trace.sequence,
                    eventInstance: signalEvent
                }
            ]
        };
    }
}
