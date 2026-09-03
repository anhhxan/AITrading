import { BaseEvent, EventFactory } from "../../infrastructure/EventFactory";
import { coreEventBus } from '@/core/infrastructure/EventBus';
import { IEngine } from "./IEngine";
import { StrategySignalEvent } from "../strategies/StrategyEngine";
import { getSupabaseAdmin } from "../../../lib/supabase";

export enum RobotState {
  WAIT_SIGNAL = 'WAIT_SIGNAL',
  WAIT_CANDLE_B_CONFIRMATION = 'WAIT_CANDLE_B_CONFIRMATION',
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
  private activePositions: Map<string, any> = new Map();
  private pendingReversalSignals: Map<string, StrategySignalEvent> = new Map();
  private signalSystemTimestamps: Map<string, number> = new Map();
  private armedSignals: Map<string, boolean> = new Map(); // Kept for backwards compatibility if needed, but not used for business logic
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
      const activePos = this.activePositions.get(robotId);
      if (activePos && activePos.side !== event.direction) {
        console.log(`[StateMachineEngine] REVERSAL DETECTED for ${robotId}. Open pos is ${activePos.side}, new signal is ${event.direction}. Queueing close.`);
        this.pendingReversalSignals.set(robotId, event);
        
        const trace = EventFactory.createTrace(event.trace.correlationId, 'rev-close', this.engineId, event.trace.sequence);
        const closeEvent = EventFactory.createEvent('FORCE_CLOSE_POSITION_EVENT', robotId, event.configVersion || 1, trace, {
            reason: 'REVERSAL'
        });
        await coreEventBus.publish(closeEvent as any);
      } else {
        console.log(`[StateMachineEngine] POSITION_ALREADY_OPEN (Same side) for robot ${robotId}: Ignoring new signal.`);
      }
      return;
    }
    
    // Switch to WAIT_CANDLE_B_CONFIRMATION and Override any existing signal
    if (currentState === RobotState.WAIT_SIGNAL || currentState === RobotState.WAIT_CANDLE_B_CONFIRMATION) {
      this.states.set(robotId, RobotState.WAIT_CANDLE_B_CONFIRMATION);
      this.activeSignals.set(robotId, event);
        this.armedSignals.set(robotId, false);
      this.timeoutCounts.set(robotId, 0); // Reset timeout
      // signalSystemTimestamps is no longer used for business logic, relying on event.payload.barTimestamp
      await this.persistState(robotId, RobotState.WAIT_CANDLE_B_CONFIRMATION);
      
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
      return;
    }
    const robotId = event.robotId;
    const currentState = this.states.get(robotId);
    
    if (currentState === RobotState.WAIT_CANDLE_B_CONFIRMATION) {
      const activeSignal = this.activeSignals.get(robotId);
      if (!activeSignal) return;

      const currentPrice = event.price;
      const trigger = activeSignal.entryTrigger;
      const armBounds = (activeSignal as any).armBounds;
      const cancelBounds = (activeSignal as any).cancelBounds;
      
      let isCancelled = false;
      if (cancelBounds) {
          if (currentPrice < cancelBounds.lower || currentPrice > cancelBounds.upper) {
              isCancelled = true;
          }
      }

      if (isCancelled) {
         this.states.set(robotId, RobotState.WAIT_SIGNAL);
         await this.persistState(robotId, RobotState.WAIT_SIGNAL);
         this.activeSignals.delete(robotId);
         this.armedSignals.delete(robotId);
         this.signalSystemTimestamps.delete(robotId);
            this.armedSignals.delete(robotId);
         
         try {
             const { getSupabaseAdmin } = require('../../../lib/supabase');
             await getSupabaseAdmin().from('active_setups').delete().eq('robot_id', robotId);
         } catch(e) {}
         
         const trace = EventFactory.createTrace(activeSignal.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
         const transitionEvent = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
             previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
             newState: RobotState.WAIT_SIGNAL,
             reason: 'CANCEL_TRIGGER_HIT',
             triggerPrice: currentPrice
         });
         await coreEventBus.publish(transitionEvent as any);
         return;
      }

        // Check if price enters ARM ZONE
        let isArmed = this.armedSignals.get(robotId) || false;
        if (!isArmed && armBounds) {
            if (currentPrice >= armBounds.lower && currentPrice <= armBounds.upper) {
                isArmed = true;
                this.armedSignals.set(robotId, true);
                console.log(`[StateMachineEngine] SIGNAL ARMED for ${robotId} at price ${currentPrice}`);
                try {
                   const { getSupabaseAdmin } = require('../../../lib/supabase');
                   getSupabaseAdmin().from('active_setups').update({ is_armed: true }).eq('robot_id', robotId).then(() => {});
                } catch(e) {}
            }
        }

      let isTriggered = false;
      
      // ONLY trigger if Armed
      if (isArmed && trigger) {
        if (currentPrice >= trigger.lower && currentPrice <= trigger.upper) {
          isTriggered = true;
        }
      }
      
      if (isTriggered) {
        this.armedSignals.delete(robotId);
        const trace = EventFactory.createTrace(
          activeSignal.trace.correlationId,
          event.eventId,
          this.engineId,
          event.trace.sequence + 1
        );

        this.states.set(robotId, RobotState.READY_TO_ENTER);
        this.timeoutCounts.set(robotId, 0);
        await this.persistState(robotId, RobotState.READY_TO_ENTER);

        const transitionEvent = EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
          oldState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
          newState: RobotState.READY_TO_ENTER,
          triggerPrice: currentPrice,
          strategyId: activeSignal.strategyId
        });

        try {
            const { getSupabaseAdmin } = require('../../../lib/supabase');
            await getSupabaseAdmin().from('active_setups').delete().eq('robot_id', robotId);
        } catch(e) {}

        await coreEventBus.publish(transitionEvent as any);
        this.activeSignals.delete(robotId);
      }
    }
  }

  private async handlePositionOpened(event: PositionOpenedEvent) {
      this.activePositions.set(event.robotId, { side: event.side, sl: event.stopLoss, tp: event.takeProfit, symbol: event.symbol });
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
        this.activePositions.delete(event.robotId);
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

        // Check if there is a pending reversal signal
        const pendingSignal = this.pendingReversalSignals.get(robotId);
        if (pendingSignal) {
            console.log(`[StateMachineEngine] Processing PENDING REVERSAL signal for ${robotId}`);
            this.pendingReversalSignals.delete(robotId);
            // Re-feed the signal now that state is WAIT_SIGNAL
            await this.handleSignalDetected(pendingSignal);
        }

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
      if (state === RobotState.WAIT_CANDLE_B_CONFIRMATION) {
        const activeSignal = this.activeSignals.get(robotId);
        
        if (activeSignal) {
            if ((activeSignal as any).persistent) continue;
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
            this.armedSignals.delete(robotId);
            
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
                previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
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



