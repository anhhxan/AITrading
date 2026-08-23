import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from "../../infrastructure/EventBus";
import { PluginLoader } from "../runtime/PluginLoader";
import { IStrategy } from "../../interfaces/PluginInterfaces";
import { IEngine } from "../runtime/IEngine";
import { IndicatorUpdatedEvent } from "../indicators/IndicatorEngine";

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
  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('CANDLE_CLOSED', async (event: any) => {
       this.currentPrices.set(event.robotId, event.candle.close);
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

    // Fallback to first indicator if explicitly named one isn't found
    const indicatorSnapshot = event.indicators['BB_MB'] || Object.values(event.indicators)[0];
    const currentPrice = this.currentPrices.get(robotId) || 0;

    const signal = PluginLoader.safeEvaluateStrategy(strategy, {
      robotId,
      indicatorSnapshot,
      previousSnapshot: (event as any).previousSnapshot || null,
      currentPrice,
      previousClose: (event as any).previousClose // FIX 3: Pass down persistent previous close
    });

    console.log(`[StrategyEngine] EVALUATED SIGNAL:`, signal);

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
        direction: signal === 'ERROR' ? 'ERROR' : (signal?.direction || 'NONE'),
        result: signal === 'ERROR' ? 'ERROR' : (signal?.direction || 'NONE'),
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
           direction: signal.direction,
           maxTimeoutCandles: signal.maxTimeoutCandles || 3,
           entryTrigger: signal.entryTrigger,
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
