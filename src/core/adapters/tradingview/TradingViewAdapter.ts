import { getSupabaseAdmin } from '../../../lib/supabase';
import { randomUUID } from 'crypto';
import { EventFactory } from '../../infrastructure/EventFactory';
import { upsertSignalTrace } from '@/lib/diagnostics';

export interface AdapterResult {
  accepted: boolean;
  validationErrors: string[];
  correlationId?: string;
  events?: {
    eventType: string;
    eventId: string;
    sequence: number;
    eventInstance?: any;
  }[];
}

export interface TradingViewPayload {
  tvSymbol: string;
  tvTickerId: string;
  timeframe: string;
  barTimestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  previousClose?: number; // Added to hold persistent previous close
  previousPayload?: any; // FULL previous payload
  indicator: {
    length: number;
    source: string;
    mult: number;
    mult2: number;
  };
  plots: {
    upper: number;
    upper2: number;
    basis: number;
    lower2: number;
    lower: number;
  };
}

export interface ExpectedConfig {
  id?: string;
  canonicalSymbol: string;
  timeframe: string;
  indicator: {
    length: number;
    source: string;
    mult: number;
    mult2: number;
  };
}

export class TradingViewAdapter {
  private configs: Map<string, ExpectedConfig> = new Map();
  private sequences: Map<string, number> = new Map();

  // Register expected config (Web App Context)
  public registerConfig(robotId: string, config: ExpectedConfig) {
    this.configs.set(robotId, config);
    this.sequences.set(robotId, 1);
  }

  // Canonicalize TradingView timeframe (e.g. "180" -> "3H")
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


  public async handleWebhook(payload: TradingViewPayload, robotId: string, commandCorrelationId?: string): Promise<AdapterResult> {
    const correlationId = commandCorrelationId || ('corr-' + payload.barTimestamp);

    console.log(JSON.stringify({
      event: 'TV_ADAPTER_RECEIVED',
      command_id: correlationId, // We don't have direct command_id here, but correlationId is passed
      correlation_id: correlationId,
      robot_id: robotId,
      barTimestamp: payload.barTimestamp || 'unknown'
    }));

    let expectedConfig = this.configs.get(robotId);
    let activeVersion = 1;

    // Fetch ACTIVE config from DB if not provided in memory (for tests)
    if (!expectedConfig) {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from('robot_configs')
          .select('id, version, indicator_profile, robots!inner(trading_view_symbol, timeframe)')
          .eq('robot_id', robotId)
          .eq('status', 'ACTIVE')
          .single();

        if (error || !data) {
          console.error(`[TradingViewAdapter] REJECT: No ACTIVE config found in DB for robot ${robotId}`, error);
          return { accepted: false, validationErrors: ['MISSING_CONFIG'] };
        }

        activeVersion = data.version;
        expectedConfig = {
          id: data.id,
          canonicalSymbol: data.robots.trading_view_symbol,
          timeframe: data.robots.timeframe,
          indicator: {
            length: data.indicator_profile.length,
            source: data.indicator_profile.source,
            mult: data.indicator_profile.mult,
            mult2: data.indicator_profile.mult2,
          }
        };
      } catch (e) {
        console.error(`[TradingViewAdapter] DB ERROR:`, e);
        return { accepted: false, validationErrors: ['DB_ERROR'] };
      }
    }

    if (!expectedConfig) {
      console.error(`[TradingViewAdapter] REJECT: No expected config found for robot ${robotId}`);
      return { accepted: false, validationErrors: ['MISSING_CONFIG'] };
    }

    // VALIDATION GATE
    const canonicalTF = this.canonicalizeTimeframe(payload.timeframe);
    const validationErrors: string[] = [];

    if (payload.tvSymbol !== expectedConfig.canonicalSymbol) validationErrors.push('Symbol mismatch');
    if (canonicalTF.toLowerCase() !== expectedConfig.timeframe.toLowerCase()) validationErrors.push('Timeframe mismatch');
    
    // Dynamic Config Update Check
    let configChanged = false;
    if (payload.indicator.length !== expectedConfig.indicator.length) configChanged = true;
    if (payload.indicator.source !== expectedConfig.indicator.source) configChanged = true;
    if (payload.indicator.mult !== expectedConfig.indicator.mult) configChanged = true;
    if (payload.indicator.mult2 !== expectedConfig.indicator.mult2) configChanged = true;

    if (configChanged && expectedConfig.id) {
        console.log(`[TradingViewAdapter] Dynamic Config Update detected for ${robotId}. Updating DB...`);
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from('robot_configs')
            .update({ indicator_profile: payload.indicator })
            .eq('id', expectedConfig.id);
            
        if (error) {
            console.error(`[TradingViewAdapter] FAILED to persist new indicator config:`, error);
            validationErrors.push('DB Config Update Failed');
        } else {
            console.log(`[TradingViewAdapter] Successfully persisted new config. Continuing with event.`);
            expectedConfig.indicator = payload.indicator; // update in-memory instance
        }
    }

    if (validationErrors.length > 0) {
      console.error(`[TradingViewAdapter] VALIDATION REJECTED:`, validationErrors);
      return { accepted: false, validationErrors }; // STOP, KHA"NG CHY STRATEGY
    }

    // CANONICAL MAPPING
    const line1 = payload.plots.upper2;
    const line2 = payload.plots.upper;
    const line3 = payload.plots.basis;
    const line4 = payload.plots.lower;
    const line5 = payload.plots.lower2;

    const candle = {
      timestamp: payload.barTimestamp,
      open: payload.open,
      high: payload.high,
      low: payload.low,
      close: payload.close,
      volume: payload.volume,
    };
    
    let previousSnapshot = null;
    let prevTimestamp = 'unknown';

    if (payload.previousPayload) {
      if (payload.previousPayload.barTimestamp) {
        prevTimestamp = String(payload.previousPayload.barTimestamp);
        
        console.log(JSON.stringify({
          event: 'TV_ADAPTER_PREVIOUS_CANDLE',
          correlation_id: correlationId,
          previousTimestamp: prevTimestamp
        }));
      }

      if (payload.previousPayload.plots) {
        previousSnapshot = {
          line1: payload.previousPayload.plots.upper,
          line2: payload.previousPayload.plots.upper2,
          line3: payload.previousPayload.plots.basis,
          line4: payload.previousPayload.plots.lower2,
          line5: payload.previousPayload.plots.lower,
        };
      }
    }

    console.log(JSON.stringify({
      event: 'TV_ADAPTER_CURRENT_CANDLE',
      correlation_id: correlationId,
      currentTimestamp: payload.barTimestamp
    }));

    let expected_delta_ms = 60000;
    if (payload.timeframe === '5') expected_delta_ms = 5 * 60000;
    if (payload.timeframe === '15') expected_delta_ms = 15 * 60000;
    
    let candle_pair_valid = true;

    if (prevTimestamp !== 'unknown' && typeof payload.barTimestamp === 'number') {
      const delta_ms = payload.barTimestamp - Number(prevTimestamp);
      
      if (delta_ms !== expected_delta_ms) {
        candle_pair_valid = false;
        let missing_candle_count = 0;
        if (delta_ms > expected_delta_ms) {
          missing_candle_count = Math.floor((delta_ms / expected_delta_ms) - 1);
        }
        
        const gapEvent = {
          event: 'CANDLE_GAP_DETECTED',
          robot_id: robotId,
          timeframe: payload.timeframe,
          previous_bar_timestamp: Number(prevTimestamp),
          current_bar_timestamp: payload.barTimestamp,
          delta_ms: delta_ms,
          expected_delta_ms: expected_delta_ms,
          missing_candle_count: missing_candle_count,
          first_missing_bar_timestamp: Number(prevTimestamp) + expected_delta_ms,
          last_missing_bar_timestamp: payload.barTimestamp - expected_delta_ms
        };
        console.log(JSON.stringify(gapEvent));
        
        upsertSignalTrace({
            robot_id: robotId,
            bar_timestamp: payload.barTimestamp,
            adapter_status: 'RED',
            diagnostics: gapEvent
        });
      } else {
        console.log(JSON.stringify({
          event: 'CANDLE_CONTINUOUS',
          robot_id: robotId,
          delta_ms: delta_ms
        }));
        
        upsertSignalTrace({
            robot_id: robotId,
            bar_timestamp: payload.barTimestamp,
            adapter_status: 'GREEN'
        });
      }
    } else if (typeof payload.barTimestamp === 'number') {
       upsertSignalTrace({
          robot_id: robotId,
          bar_timestamp: payload.barTimestamp,
          adapter_status: 'GREEN'
      });
    }

    let seq = this.sequences.get(robotId) || 1;
    
    // To Event INDICATOR_UPDATED_EVENT tng `ng v>i kt qu c a IndicatorEngine
    const trace1 = EventFactory.createTrace(correlationId, 'webhook-' + randomUUID(), 'TradingViewAdapter', seq++);
    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, activeVersion, trace1, { candle });
    
    const trace2 = EventFactory.createTrace(correlationId, candleEvent.eventId, 'TradingViewAdapter', seq++);
    const indicatorUpdatedEvent = EventFactory.createEvent('INDICATOR_UPDATED', robotId, activeVersion, trace2, {
      barTimestamp: payload.barTimestamp,
      candlePairValid: candle_pair_valid,
      previousClose: payload.previousPayload?.close || null,
      previousSnapshot: previousSnapshot,
      indicators: {
        'BB_MB': {
          ready: true,
          line1, line2, line3, line4, line5,
          config: expectedConfig.indicator
        }
      }
    });

    console.log(`[TradingViewAdapter] Validation PASS. Generated CANDLE_CLOSED and INDICATOR_UPDATED_EVENT for ${robotId}.`);
    
    this.sequences.set(robotId, seq);
    
    return {
      accepted: true,
      validationErrors: [],
      correlationId,
      events: [
        {
          eventType: 'CANDLE_CLOSED',
          eventId: candleEvent.eventId,
          sequence: candleEvent.trace.sequence,
          eventInstance: candleEvent
        },
        {
          eventType: 'INDICATOR_UPDATED',
          eventId: indicatorUpdatedEvent.eventId,
          sequence: indicatorUpdatedEvent.trace.sequence,
          eventInstance: indicatorUpdatedEvent
        }
      ]
    };
  }
}
