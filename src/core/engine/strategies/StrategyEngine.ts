import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from "../../infrastructure/EventBus";
import { PluginLoader } from "../runtime/PluginLoader";
import { IStrategy } from "../../interfaces/PluginInterfaces";
import { IEngine } from "../runtime/IEngine";
import { IndicatorUpdatedEvent } from "../indicators/IndicatorEngine";
import { upsertSignalTrace } from '@/lib/diagnostics';

export interface StrategySignalEvent extends BaseEvent {
  direction: 'LONG' | 'SHORT' | 'NONE';
  maxTimeoutCandles: number;
  entryTrigger?: {
    type: string;
    lower: number;
    upper: number;
  };
  strategyId: string;
  strategyVersion: string;
  indicatorReference?: {
    name: string;
    config: any;
    snapshot: {
      line1: number | null;
      line2: number | null;
      line3: number | null;
      line4: number | null;
      line5: number | null;
    }
  };
}

export class StrategyEngine implements IEngine {
  public engineId = 'StrategyEngine_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private robotConfig: Map<string, IStrategy> = new Map();
  private currentPrices: Map<string, number> = new Map();
  private currentHighs: Map<string, number> = new Map();
  private currentLows: Map<string, number> = new Map();
  private currentTimestamps: Map<string, number> = new Map();
  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('CANDLE_CLOSED', async (event: any) => {
       this.currentPrices.set(event.robotId, event.candle.close);
       this.currentHighs.set(event.robotId, event.candle.high);
       this.currentLows.set(event.robotId, event.candle.low);
       this.currentTimestamps.set(event.robotId, event.candle.timestamp);
    }));

    this.unsubs.push(coreEventBus.subscribe('INDICATOR_UPDATED', async (event: IndicatorUpdatedEvent) => {
       await this.handleIndicatorUpdated(event);
    }));

    this.status = 'READY';
  }

  public registerRobot(robotId: string, strategyName: string, params: any) {
     const instance = PluginLoader.loadStrategy(strategyName);
     instance.init(params);
     this.robotConfig.set(robotId, instance);
  }

  private async handleIndicatorUpdated(event: IndicatorUpdatedEvent) {
    const robotId = event.robotId;
    const strategy = this.robotConfig.get(robotId);
    if (!strategy) return;

    if ((event as any).candlePairValid === false) {
       console.log(`[StrategyEngine] Skipped evaluation for ${robotId} due to INVALID candle pair (GAP).`);
       return;
    }

    // Fallback to first indicator if explicitly named one isn't found
    const indicatorSnapshot = event.indicators['BB_MB'] || Object.values(event.indicators)[0];
    const currentPrice = this.currentPrices.get(robotId) || 0;
    const currentHigh = this.currentHighs.get(robotId) || 0;
    const currentLow = this.currentLows.get(robotId) || 0;
    const barTimestamp = this.currentTimestamps.get(robotId) || 'unknown';
    const previousClose = (event as any).previousClose;
    const previousSnapshot = (event as any).previousSnapshot || null;

    const signal = PluginLoader.safeEvaluateStrategy(strategy, {
      robotId,
      indicatorSnapshot,
      previousSnapshot,
      currentPrice,
      currentHigh,
      currentLow,
      previousClose // FIX 3: Pass down persistent previous close
    });

    const direction = signal === 'ERROR' ? 'ERROR' : (signal?.direction || 'NONE');

    let diagnostics = {};
    if (direction === 'NONE' || direction === 'LONG' || direction === 'SHORT') {
       if (previousSnapshot && indicatorSnapshot && previousClose !== undefined) {
         // Reconstruct the logic for logging purposes without changing it
         const LONG_C1 = previousClose < previousSnapshot.line5;
         const LONG_C2 = previousClose <= previousSnapshot.line4;
         const LONG_C3 = currentPrice > indicatorSnapshot.line5;

         const SHORT_C1 = previousClose >= previousSnapshot.line2;
         const SHORT_C2 = previousClose > previousSnapshot.line1;
         const SHORT_C3 = currentPrice < indicatorSnapshot.line1;
         
         diagnostics = {
           LONG_C1, LONG_C2, LONG_C3,
           SHORT_C1, SHORT_C2, SHORT_C3,
           prevClose: previousClose,
           currClose: currentPrice,
           prevSnapshot: previousSnapshot,
           currSnapshot: indicatorSnapshot
         };
       }
    }

    console.log(JSON.stringify({
      event: 'STRATEGY_EVALUATED',
      correlation_id: event.trace.correlationId,
      robot_id: robotId,
      barTimestamp,
      result: direction,
      diagnostics
    }));
    
    if (barTimestamp !== 'unknown') {
        upsertSignalTrace({
            robot_id: robotId,
            bar_timestamp: Number(barTimestamp),
            strategy_status: 'GREEN',
            strategy_result: direction,
            diagnostics: Object.keys(diagnostics).length > 0 ? diagnostics : undefined
        });
    }

    // ==========================================
    // OBSERVABILITY EVENT (Always published, even for NONE)
    // ==========================================
    const evalTrace = EventFactory.createTrace(
      event.trace.correlationId,
      event.eventId,
      this.engineId,
      event.trace.sequence
    );

    const evaluatedEvent = EventFactory.createEvent(
      'STRATEGY_EVALUATED',
      robotId, event.configVersion || 1,
      evalTrace,
      {
        direction,
        result: direction,
        commandId: event.trace.correlationId,
        strategyId: strategy.name
      }
    );
    await coreEventBus.publish(evaluatedEvent as any);

    // ==========================================
    // TRADING SIGNAL EVENT (Only published for LONG/SHORT)
    // ==========================================
    if (signal !== 'ERROR' && signal && signal.direction !== 'NONE') {
       const trace = EventFactory.createTrace(
         event.trace.correlationId,
         event.eventId,
         this.engineId,
         event.trace.sequence
       );

       const indicatorName = event.indicators['BB_MB'] ? 'BB_MB' : Object.keys(event.indicators)[0];
       
       const nextEvent = EventFactory.createEvent(
         'STRATEGY_SIGNAL_EVENT',
         robotId, event.configVersion || 1,
         trace,
         { 
           barTimestamp: (event as any).barTimestamp,
           direction: signal.direction,
           maxTimeoutCandles: signal.maxTimeoutCandles || 3,
           persistent: signal.persistent,
           entryTrigger: signal.entryTrigger,
           cancelTrigger: signal.cancelTrigger,
           strategyId: strategy.name,
           strategyVersion: 'v1.0.0',
           indicatorReference: {
             name: indicatorName,
             config: indicatorSnapshot.config || {},
             snapshot: {
               line1: indicatorSnapshot.line1,
               line2: indicatorSnapshot.line2,
               line3: indicatorSnapshot.line3,
               line4: indicatorSnapshot.line4,
               line5: indicatorSnapshot.line5
             }
           }
         }
       );
       
       await coreEventBus.publish(nextEvent as any);
    }
  }

  public healthCheck(): any {
    return { status: this.status };
  }

  public ready(): boolean { 
    return this.status === 'READY'; 
  }

  public async shutdown(): Promise<void> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.status = 'STOPPED';
  }
}
