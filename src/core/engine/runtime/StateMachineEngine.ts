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
  private signalSystemTimestamps: Map<string, number> = new Map(); // Kept for backwards compatibility if needed, but not used for business logic
  private robotTimeframes: Map<string, string> = new Map();
  private intervalId: any;

  private unsubs: (() => void)[] = [];

  public async initialize(): Promise<void> {
    this.status = 'STARTING';
    
    this.unsubs.push(coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', async (e: StrategySignalEvent) => {
       await this.handleSignalDetected(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('REALTIME_PRICE_EVENT', async (e: any) => {
       await this.handleRealtimePrice(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('POSITION_OPENED_EVENT', async (e: PositionOpenedEvent) => {
       await this.handlePositionOpened(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('POSITION_CLOSED_EVENT', async (e: PositionClosedEvent) => {
       await this.handlePositionClosed(e);
    }));

    this.unsubs.push(coreEventBus.subscribe('RISK_REJECTED_EVENT', async (e: any) => {
       await this.handleRiskRejected(e);
    }));

    this.intervalId = setInterval(() => this.checkTimeouts(), 5000);

    this.status = 'READY';
  }

  private getTimeframeDurationMs(timeframe: string): number {
      const tf = timeframe.toLowerCase();
      if (tf === '1m') return 60000;
      if (tf === '3m') return 3 * 60000;
      if (tf === '5m') return 5 * 60000;
      if (tf === '10m') return 10 * 60000;
      if (tf === '15m') return 15 * 60000;
      if (tf === '30m') return 30 * 60000;
      if (tf === '45m') return 45 * 60000;
      if (tf === '1h') return 60 * 60000;
      return 60000; // default 1m
  }

  public registerRobot(robotId: string, timeframe: string = '1m') {
    this.robotTimeframes.set(robotId, timeframe.toLowerCase());
    this.states.set(robotId, RobotState.WAIT_SIGNAL);
  }

  private async handleSignalDetected(event: StrategySignalEvent) {
    console.log('[StateMachineEngine] handleSignalDetected:', event.eventType, event.direction);
    if (event.direction === 'NONE') return;

    const robotId = event.robotId;
    const currentState = this.states.get(robotId) || RobotState.WAIT_SIGNAL;
    
    if (currentState === RobotState.POSITION_OPEN) {
      console.log(`[StateMachineEngine] POSITION_ALREADY_OPEN for robot ${robotId}: Ignoring new signal.`);
      return;
    }
    
    // Switch to WAIT_RETRACEMENT and Override any existing signal
    if (currentState === RobotState.WAIT_SIGNAL || currentState === RobotState.WAIT_RETRACEMENT) {
      this.states.set(robotId, RobotState.WAIT_RETRACEMENT);
      this.activeSignals.set(robotId, event);
      this.timeoutCounts.set(robotId, 0); // Reset timeout
      // signalSystemTimestamps is no longer used for business logic, relying on event.payload.barTimestamp
      await this.persistState(robotId, RobotState.WAIT_RETRACEMENT);
      
      const timeframe = this.robotTimeframes.get(robotId) || '1m';
      const durationMs = ((event as any).maxTimeoutCandles || 3) * this.getTimeframeDurationMs(timeframe);
      
      console.log(JSON.stringify({
        event: 'TIMEOUT_STARTED',
        robot_id: robotId,
        timeframe: timeframe,
        correlation_id: event.trace.correlationId,
        signal_bar_timestamp: (event as any).barTimestamp,
        signal_time_utc: new Date((event as any).barTimestamp || Date.now()).toISOString(),
        timeout_duration_ms: durationMs
      }));
    }
  }

  private async handleRealtimePrice(event: any) {
    if (event.price <= 0 || event.eventTimestamp <= 0) {
      return; // ENTRY SAFETY: Ignore invalid realtime price ticks
    }
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    if (currentState === RobotState.WAIT_RETRACEMENT) {
      const activeSignal = this.activeSignals.get(robotId);
      if (!activeSignal) return;

      const currentPrice = event.price;
      const trigger = activeSignal.entryTrigger;
      
      let isTriggered = false;
      
      if (trigger) {
        if (activeSignal.direction === 'LONG') {
          isTriggered = currentPrice >= trigger.lower! && currentPrice <= trigger.upper!;
        } else if (activeSignal.direction === 'SHORT') {
          isTriggered = currentPrice >= trigger.lower! && currentPrice <= trigger.upper!;
        }
      }
      
      if (isTriggered) {
        const trace = EventFactory.createTrace(
          activeSignal.trace.correlationId,
          event.eventId,
          this.engineId, 
          event.trace.sequence
        );
        
        const zoneTouchedPayload = {
            direction: activeSignal.direction,
            price: currentPrice,
            zone_lower: trigger?.lower,
            zone_upper: trigger?.upper,
            timestamp: Date.now()
        };
        console.log(JSON.stringify({ event: 'RETRACEMENT_ZONE_TOUCHED', robot_id: robotId, ...zoneTouchedPayload }));
        await coreEventBus.publish(EventFactory.createEvent('RETRACEMENT_ZONE_TOUCHED', robotId, 1, trace, zoneTouchedPayload) as any);
        
        // Atomic transition
        this.states.set(robotId, RobotState.READY_TO_ENTER);
        await this.persistState(robotId, RobotState.READY_TO_ENTER);
        
        const entryTriggeredPayload = {
            direction: activeSignal.direction,
            entry_price: currentPrice,
            signal_bar_timestamp: (activeSignal as any).barTimestamp,
            market_timestamp: event.eventTimestamp,
            entry_timestamp: Date.now()
        };
        console.log(JSON.stringify({ event: 'RETRACEMENT_ENTRY_TRIGGERED', robot_id: robotId, ...entryTriggeredPayload }));
        await coreEventBus.publish(EventFactory.createEvent('RETRACEMENT_ENTRY_TRIGGERED', robotId, 1, trace, entryTriggeredPayload) as any);

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

  private async handleRiskRejected(event: any) {
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    // Valid transition: READY_TO_ENTER -> WAIT_SIGNAL
    if (currentState === RobotState.READY_TO_ENTER) {
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
          previousState: RobotState.READY_TO_ENTER,
          newState: RobotState.WAIT_SIGNAL,
          reason: 'RISK_REJECTED'
        }
      );
      await coreEventBus.publish(transitionEvent as any);
    }
  }

  private async checkTimeouts() {
    const now = Date.now();
    for (const [robotId, state] of this.states.entries()) {
      if (state === RobotState.WAIT_RETRACEMENT) {
        const activeSignal = this.activeSignals.get(robotId);
        
        if (activeSignal) {
          const timeframe = this.robotTimeframes.get(robotId);
          if (!timeframe) {
              console.error(`[StateMachineEngine] CONFIG_ERROR for ${robotId}: Missing timeframe config`);
              continue; // FAIL SAFE
          }

      const timeframeMs = this.getTimeframeDurationMs(timeframe);
      const maxTimeout = (activeSignal as any).maxTimeoutCandles || 3;
      const maxTimeoutMs = maxTimeout * timeframeMs;
      
      const signalBarTimestamp = (activeSignal as any).barTimestamp;
          if (!signalBarTimestamp) {
              console.error(`[StateMachineEngine] TIMEOUT_STATE_INVALID for ${robotId}: Missing signal barTimestamp`);
              continue; // FAIL SAFE
          }

          const elapsedMs = now - signalBarTimestamp;

          if (elapsedMs >= maxTimeoutMs) {
            console.log(JSON.stringify({
              event: 'RETRACEMENT_TIMEOUT',
              robot_id: robotId,
              timeframe: timeframe,
              correlation_id: activeSignal.trace.correlationId,
              signal_bar_timestamp: signalBarTimestamp,
              timeout_at: new Date(now).toISOString(),
              elapsed_ms: elapsedMs,
              timeout_duration_ms: maxTimeoutMs,
              reason: 'TIME_BASED_TIMEOUT'
            }));
            
            this.states.set(robotId, RobotState.WAIT_SIGNAL);
            await this.persistState(robotId, RobotState.WAIT_SIGNAL);
            this.signalSystemTimestamps.delete(robotId);
            
            const trace = EventFactory.createTrace(
              activeSignal.trace.correlationId,
              'TIMEOUT_' + now, 
              this.engineId, 
              now
            );
            
            const transitionEvent = EventFactory.createEvent(
              'STATE_TRANSITION_EVENT', 
              robotId, 1, 
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
    if (this.intervalId) clearInterval(this.intervalId);
    this.status = 'STOPPED';
  }
}
