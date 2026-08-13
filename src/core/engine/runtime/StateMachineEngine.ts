import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from "../../infrastructure/EventBus";
import { IEngine } from "./IEngine";
import { StrategySignalEvent } from "../strategies/StrategyEngine";
import { getSupabaseAdmin } from "../../../lib/supabase";

export enum RobotState {
  WAIT_SIGNAL = 'WAIT_SIGNAL',
  WAIT_RETRACEMENT = 'WAIT_RETRACEMENT',
  READY_TO_ENTER = 'READY_TO_ENTER',
  POSITION_OPEN = 'POSITION_OPEN'
}

export interface StateTransitionEvent extends BaseEvent {
  previousState: RobotState;
  newState: RobotState;
  reason: string;
  triggerPrice?: number;
}

export interface PositionOpenedEvent extends BaseEvent {
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
}

export interface PositionClosedEvent extends BaseEvent {
  symbol: string;
  side: string;
  quantity: number;
  exitPrice: number;
  realizedPnl: number;
  closeReason: string;
}

export class StateMachineEngine implements IEngine {
  public engineId = 'StateMachineEngine_1';
  private status: 'READY' | 'STARTING' | 'ERROR' | 'STOPPED' = 'STOPPED';
  
  private states: Map<string, RobotState> = new Map();
  private timeoutCounts: Map<string, number> = new Map();
  private activeSignals: Map<string, StrategySignalEvent> = new Map();

  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', async (e: StrategySignalEvent) => {
       await this.handleSignalDetected(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('CANDLE_CLOSED', async (e: any) => {
       await this.handleCandleClosed(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('POSITION_OPENED_EVENT', async (e: PositionOpenedEvent) => {
       await this.handlePositionOpened(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('POSITION_CLOSED_EVENT', async (e: PositionClosedEvent) => {
       await this.handlePositionClosed(e);
    }));

    this.status = 'READY';
  }

  public registerRobot(robotId: string, _legacyMaxTimeout: number = 3) {
    this.states.set(robotId, RobotState.WAIT_SIGNAL);
  }

  private async handleSignalDetected(event: StrategySignalEvent) {
    console.log('[StateMachineEngine] handleSignalDetected:', event.eventType, event.direction);
    if (event.direction === 'NONE') return;

    const robotId = event.robotId;
    const currentState = this.states.get(robotId) || RobotState.WAIT_SIGNAL;
    
    // Switch to WAIT_RETRACEMENT and Override any existing signal
    if (currentState === RobotState.WAIT_SIGNAL || currentState === RobotState.WAIT_RETRACEMENT) {
      this.states.set(robotId, RobotState.WAIT_RETRACEMENT);
      this.activeSignals.set(robotId, event);
      this.timeoutCounts.set(robotId, 0); // Reset timeout
      await this.persistState(robotId, RobotState.WAIT_RETRACEMENT);
    }
  }

  private async handleCandleClosed(event: any) {
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    if (currentState === RobotState.WAIT_RETRACEMENT) {
      const activeSignal = this.activeSignals.get(robotId);
      if (!activeSignal) return;

      const currentPrice = event.candle.close;
      const trigger = activeSignal.entryTrigger;

      // 1. Check Trigger FIRST
      let isTriggered = false;
      if (trigger && currentPrice >= trigger.lower && currentPrice <= trigger.upper) {
        isTriggered = true;
      }

      if (isTriggered) {
        this.states.set(robotId, RobotState.READY_TO_ENTER);
        await this.persistState(robotId, RobotState.READY_TO_ENTER);
        
        const trace = EventFactory.createTrace(
          activeSignal.trace.correlationId, // Preserve original correlationId
          event.eventId,                    // Parent is the triggering candle
          this.engineId, 
          event.trace.sequence              // Sequence of the triggering candle
        );

        const transitionEvent = EventFactory.createEvent(
          'STATE_TRANSITION_EVENT', 
          robotId, event.configVersion || 1, 
          trace, 
          { 
            previousState: RobotState.WAIT_RETRACEMENT,
            newState: RobotState.READY_TO_ENTER,
            reason: 'TRIGGER_MATCHED',
            triggerPrice: currentPrice
          }
        );
        await coreEventBus.publish(transitionEvent as any);
        return;
      }

      // 2. If not triggered, check Timeout
      let count = (this.timeoutCounts.get(robotId) || 0) + 1;
      this.timeoutCounts.set(robotId, count);

      const maxTimeout = activeSignal.maxTimeoutCandles || 3;

      if (count > maxTimeout) {
        this.states.set(robotId, RobotState.WAIT_SIGNAL);
        await this.persistState(robotId, RobotState.WAIT_SIGNAL);
        
        const trace = EventFactory.createTrace(
          activeSignal.trace.correlationId,
          event.eventId, 
          this.engineId, 
          event.trace.sequence
        );
        
        const transitionEvent = EventFactory.createEvent(
          'STATE_TRANSITION_EVENT', 
          robotId, event.configVersion || 1, 
          trace, 
          { 
            previousState: RobotState.WAIT_RETRACEMENT,
            newState: RobotState.WAIT_SIGNAL,
            reason: 'TIMEOUT'
          }
        );
        await coreEventBus.publish(transitionEvent as any);
      }
    }
  }

  private async handlePositionOpened(event: PositionOpenedEvent) {
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    // Valid transition: READY_TO_ENTER -> POSITION_OPEN
    if (currentState === RobotState.READY_TO_ENTER) {
      this.states.set(robotId, RobotState.POSITION_OPEN);
      await this.persistState(robotId, RobotState.POSITION_OPEN);
      
      const trace = EventFactory.createTrace(
        event.trace.correlationId,
        event.eventId,
        this.engineId,
        event.trace.sequence
      );

      const transitionEvent = EventFactory.createEvent(
        'STATE_TRANSITION_EVENT',
        robotId, event.configVersion || 1,
        trace,
        {
          previousState: RobotState.READY_TO_ENTER,
          newState: RobotState.POSITION_OPEN,
          reason: 'POSITION_OPENED'
        }
      );
      await coreEventBus.publish(transitionEvent as any);
    } else {
      console.warn(`[StateMachineEngine] REJECTED POSITION_OPENED_EVENT for ${robotId}. Invalid state: ${currentState}`);
    }
  }

  private async handlePositionClosed(event: PositionClosedEvent) {
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    // Valid transition: POSITION_OPEN -> WAIT_SIGNAL
    if (currentState === RobotState.POSITION_OPEN) {
      this.states.set(robotId, RobotState.WAIT_SIGNAL);
      await this.persistState(robotId, RobotState.WAIT_SIGNAL);
      
      const trace = EventFactory.createTrace(
        event.trace.correlationId,
        event.eventId,
        this.engineId,
        event.trace.sequence
      );

      const transitionEvent = EventFactory.createEvent(
        'STATE_TRANSITION_EVENT',
        robotId, event.configVersion || 1,
        trace,
        {
          previousState: RobotState.POSITION_OPEN,
          newState: RobotState.WAIT_SIGNAL,
          reason: 'POSITION_CLOSED'
        }
      );
      await coreEventBus.publish(transitionEvent as any);
    } else {
      console.warn(`[StateMachineEngine] REJECTED POSITION_CLOSED_EVENT for ${robotId}. Invalid state: ${currentState}`);
    }
  }

  public getState(robotId: string): RobotState | undefined {
    return this.states.get(robotId);
  }

  private async persistState(robotId: string, state: RobotState) {
    try {
      const supabase = getSupabaseAdmin();
      // Try to update using name OR id safely. If robotId is not UUID, id = robotId will fail, but we catch it.
      let { error } = await supabase.from('robots').update({ 
        current_state: state, 
        current_state_updated_at: new Date().toISOString() 
      }).eq('id', robotId);
      
      if (error && error.code === '22P02') { // invalid UUID
        error = (await supabase.from('robots').update({ 
          current_state: state, 
          current_state_updated_at: new Date().toISOString() 
        }).eq('name', robotId)).error;
      }
      
      if (error) {
        console.error(`[StateMachineEngine] Persistence ERROR for ${robotId}:`, error);
      }
    } catch (err) {
      console.error(`[StateMachineEngine] Persistence EXCEPTION for ${robotId}:`, err);
    }
  }

  public healthCheck(): any { return { status: this.status }; }
  public ready(): boolean { return this.status === 'READY'; }
  public async shutdown(): Promise<void> {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.status = 'STOPPED';
  }
}
