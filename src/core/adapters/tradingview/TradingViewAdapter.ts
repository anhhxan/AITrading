import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { randomUUID } from 'crypto';

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
    if (tvTimeframe === '60') return '1H';
    if (tvTimeframe === '120') return '2H';
    if (tvTimeframe === '180') return '3H';
    if (tvTimeframe === '240') return '4H';
    if (tvTimeframe === 'D' || tvTimeframe === '1D') return '1D';
    return tvTimeframe;
  }

  // Xử lý Payload từ Webhook
  public async handleWebhook(payload: TradingViewPayload, robotId: string): Promise<boolean> {
    const expectedConfig = this.configs.get(robotId);
    if (!expectedConfig) {
      console.error(`[TradingViewAdapter] REJECT: No expected config found for robot ${robotId}`);
      return false;
    }

    // VALIDATION GATE
    const canonicalTF = this.canonicalizeTimeframe(payload.timeframe);
    const validationErrors: string[] = [];

    if (payload.tvSymbol !== expectedConfig.canonicalSymbol) validationErrors.push('Symbol mismatch');
    if (canonicalTF !== expectedConfig.timeframe) validationErrors.push('Timeframe mismatch');
    if (payload.indicator.length !== expectedConfig.indicator.length) validationErrors.push('Length mismatch');
    if (payload.indicator.source !== expectedConfig.indicator.source) validationErrors.push('Source mismatch');
    if (payload.indicator.mult !== expectedConfig.indicator.mult) validationErrors.push('Mult mismatch');
    if (payload.indicator.mult2 !== expectedConfig.indicator.mult2) validationErrors.push('Mult2 mismatch');

    if (validationErrors.length > 0) {
      console.error(`[TradingViewAdapter] VALIDATION REJECTED:`, validationErrors);
      return false; // STOP, KHÔNG CHẠY STRATEGY
    }

    // CANONICAL MAPPING
    const line1 = payload.plots.upper;
    const line2 = payload.plots.upper2;
    const line3 = payload.plots.basis;
    const line4 = payload.plots.lower2;
    const line5 = payload.plots.lower;

    const candle = {
      timestamp: payload.barTimestamp,
      open: payload.open,
      high: payload.high,
      low: payload.low,
      close: payload.close,
      volume: payload.volume,
    };

    let seq = this.sequences.get(robotId) || 1;
    
    // Tạo Event INDICATOR_UPDATED_EVENT tương đương với kết quả của IndicatorEngine
    const trace1 = EventFactory.createTrace('corr-' + payload.barTimestamp, 'webhook-' + randomUUID(), 'TradingViewAdapter', seq++);
    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, trace1, { candle });
    
    const trace2 = EventFactory.createTrace('corr-' + payload.barTimestamp, candleEvent.eventId, 'TradingViewAdapter', seq++);
    const indicatorUpdatedEvent = EventFactory.createEvent('INDICATOR_UPDATED', robotId, trace2, {
      indicators: {
        'BB_MB': {
          ready: true,
          line1, line2, line3, line4, line5,
          config: expectedConfig.indicator
        }
      }
    });

    console.log(`[TradingViewAdapter] Validation PASS. Emitting CANDLE_CLOSED and INDICATOR_UPDATED_EVENT for ${robotId}.`);
    
    // Đảm bảo StateMachine nhận được nến để check trigger, và Strategy nhận được indicator
    await coreEventBus.publish(candleEvent);
    await coreEventBus.publish(indicatorUpdatedEvent);
    
    this.sequences.set(robotId, seq);
    return true;
  }
}
