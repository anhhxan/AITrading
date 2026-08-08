import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from "../../infrastructure/EventBus";
import { PluginLoader } from "../runtime/PluginLoader";
import { IStrategy } from "../../interfaces/PluginInterfaces";
import { IEngine } from "../runtime/IEngine";
import { IndicatorUpdatedEvent } from "../indicators/IndicatorEngine";

export interface SignalDetectedEvent extends BaseEvent {
  signalSide: 'LONG' | 'SHORT';
  currentPrice: number;
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
      currentPrice
    });

    if (signal === 'LONG' || signal === 'SHORT') {
       const trace = EventFactory.createTrace(
         event.trace.correlationId,
         event.eventId,
         this.engineId,
         event.trace.sequence + 1
       );

       const nextEvent = EventFactory.createEvent(
         'SIGNAL_DETECTED',
         robotId,
         trace,
         { signalSide: signal, currentPrice }
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
