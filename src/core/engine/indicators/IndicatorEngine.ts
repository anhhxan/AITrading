import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from "../../infrastructure/EventBus";
import { PluginLoader } from "../runtime/PluginLoader";
import { Candle, IIndicator } from "../../interfaces/PluginInterfaces";
import { IEngine } from "../runtime/IEngine";

export interface CandleClosedEvent extends BaseEvent {
  candle: Candle;
}

export interface IndicatorUpdatedEvent extends BaseEvent {
  indicators: Record<string, any>;
}

export class IndicatorEngine implements IEngine {
  public engineId = 'IndicatorEngine_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  // robotId -> array of active indicator instances
  private robotConfig: Map<string, IIndicator[]> = new Map();
  private unsubscribe: (() => void) | null = null;

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubscribe = coreEventBus.subscribe('CANDLE_CLOSED', async (event: CandleClosedEvent) => {
       await this.handleCandleClosed(event);
    });

    this.status = 'READY';
  }

  public registerRobot(robotId: string, indicators: { name: string, params: any }[]) {
     const instances = indicators.map(ind => {
        const instance = PluginLoader.loadIndicator(ind.name);
        instance.init(ind.params);
        return instance;
     });
     this.robotConfig.set(robotId, instances);
  }

  private async handleCandleClosed(event: CandleClosedEvent) {
    const robotId = event.robotId;
    const indicators = this.robotConfig.get(robotId);
    if (!indicators) return;

    const snapshotResult: Record<string, any> = {};
    let allReady = true;

    for (const ind of indicators) {
       const result = PluginLoader.safeUpdate(ind, event.candle);
       snapshotResult[ind.name] = result;
       
       if (!result.ready) {
         allReady = false;
       }
    }

    // Warmup Rule: Only emit EVENT if ALL indicators are warmed up (ready: true)
    if (allReady) {
       const trace = EventFactory.createTrace(
         event.trace.correlationId,
         event.eventId,
         this.engineId,
         event.trace.sequence + 1
       );

       const nextEvent = EventFactory.createEvent(
         'INDICATOR_UPDATED',
         robotId,
         trace,
         { indicators: snapshotResult }
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
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.status = 'STOPPED';
  }
}
