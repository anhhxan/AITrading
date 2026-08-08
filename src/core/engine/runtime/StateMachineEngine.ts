import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from "../../infrastructure/EventBus";
import { IEngine } from "./IEngine";
import { SignalDetectedEvent } from "../strategies/StrategyEngine";
import { BB_Strategy } from "../../plugins/strategies/BB_Strategy";
import { IndicatorUpdatedEvent } from "../indicators/IndicatorEngine";

export enum RobotState {
  WAIT_SIGNAL = 'WAIT_SIGNAL',
  WAIT_RETRACEMENT = 'WAIT_RETRACEMENT',
  READY_TO_ENTER = 'READY_TO_ENTER'
}

export interface ReadyToEnterEvent extends BaseEvent {
  signalSide: 'LONG' | 'SHORT';
  entryPrice: number;
}

export interface EntryTimeoutEvent extends BaseEvent {
  reason: string;
}

export class StateMachineEngine implements IEngine {
  public engineId = 'StateMachineEngine_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private states: Map<string, RobotState> = new Map();
  private signalSides: Map<string, 'LONG' | 'SHORT'> = new Map();
  private timeoutCounts: Map<string, number> = new Map();
  private latestIndicators: Map<string, any> = new Map();
  private maxTimeoutCandles: Map<string, number> = new Map();

  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('SIGNAL_DETECTED', async (e: SignalDetectedEvent) => {
       await this.handleSignalDetected(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('INDICATOR_UPDATED', async (e: IndicatorUpdatedEvent) => {
       this.latestIndicators.set(e.robotId, e.indicators['BB_MB'] || Object.values(e.indicators)[0]);
    }));

    this.unsubs.push(coreEventBus.subscribe('CANDLE_CLOSED', async (e: any) => {
       await this.handleCandleClosed(e);
    }));

    this.status = 'READY';
  }

  public registerRobot(robotId: string, maxTimeout: number = 3) {
    this.states.set(robotId, RobotState.WAIT_SIGNAL);
    this.maxTimeoutCandles.set(robotId, maxTimeout);
  }

  private async handleSignalDetected(event: SignalDetectedEvent) {
    const robotId = event.robotId;
    const currentState = this.states.get(robotId) || RobotState.WAIT_SIGNAL;
    
    if (currentState === RobotState.WAIT_SIGNAL) {
      this.states.set(robotId, RobotState.WAIT_RETRACEMENT);
      this.signalSides.set(robotId, event.signalSide);
      this.timeoutCounts.set(robotId, 0);
    }
  }

  private async handleCandleClosed(event: any) {
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    if (currentState === RobotState.WAIT_RETRACEMENT) {
      let count = (this.timeoutCounts.get(robotId) || 0) + 1;
      this.timeoutCounts.set(robotId, count);

      const maxTimeout = this.maxTimeoutCandles.get(robotId) || 3;

      if (count > maxTimeout) {
        this.states.set(robotId, RobotState.WAIT_SIGNAL);
        
        const trace = EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence + 1);
        const timeoutEvent = EventFactory.createEvent('ENTRY_TIMEOUT', robotId, trace, { reason: 'TIMEOUT' });
        await coreEventBus.publish(timeoutEvent as any);
        return;
      }

      // Check Retracement Zone (Sử dụng tạm class trực tiếp đúng nguyên tắc Make it Work)
      const signalSide = this.signalSides.get(robotId)!;
      const indicator = this.latestIndicators.get(robotId);
      const currentPrice = event.candle.close;

      if (!indicator) return;

      const strategy = new BB_Strategy();
      strategy.init({ retracementZonePercent: 20 });
      const inZone = strategy.isPriceInRetracementZone(signalSide, currentPrice, indicator);

      if (inZone) {
        this.states.set(robotId, RobotState.READY_TO_ENTER);
        
        const trace = EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence + 1);
        const enterEvent = EventFactory.createEvent('READY_TO_ENTER', robotId, trace, { 
          signalSide, entryPrice: currentPrice 
        });
        await coreEventBus.publish(enterEvent as any);
      }
    }
  }

  public getState(robotId: string): RobotState | undefined {
    return this.states.get(robotId);
  }

  public healthCheck(): any { return { status: this.status }; }
  public ready(): boolean { return this.status === 'READY'; }
  public async shutdown(): Promise<void> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.status = 'STOPPED';
  }
}
