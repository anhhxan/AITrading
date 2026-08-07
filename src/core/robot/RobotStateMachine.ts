import { EventBus, TradingEvent } from '../events/EventBus';
import { LockManager } from '../locks/LockManager';
import { IIndicator, IStrategy, SignalSide, StrategyContext } from '../interfaces/PluginInterfaces';

export enum RobotState {
  WAIT_SIGNAL = 'WAIT_SIGNAL',
  SIGNAL_DETECTED = 'SIGNAL_DETECTED',
  WAIT_RETRACEMENT = 'WAIT_RETRACEMENT',
  READY_TO_ENTER = 'READY_TO_ENTER',
  POSITION_OPEN = 'POSITION_OPEN',
  WAIT_EXIT = 'WAIT_EXIT',
  POSITION_CLOSE = 'POSITION_CLOSE'
}

export class RobotStateMachine {
  public id: string;
  public state: RobotState;
  
  private indicatorPlugin: IIndicator;
  private strategyPlugin: IStrategy;
  
  private currentTimeoutCount: number = 0;
  private maxTimeoutCandles: number = 3;

  constructor(id: string, indicator: IIndicator, strategy: IStrategy, maxTimeout: number = 3) {
    this.id = id;
    this.state = RobotState.WAIT_SIGNAL;
    this.indicatorPlugin = indicator;
    this.strategyPlugin = strategy;
    this.maxTimeoutCandles = maxTimeout;
    
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen to market data for this specific robot's symbol
    // In a real scenario, we'd filter events by symbol or robot_id
    EventBus.subscribe(TradingEvent.CANDLE_CLOSED, this.handleCandleClosed.bind(this));
  }

  private async handleCandleClosed(candleData: any): Promise<void> {
    // 1. Update Indicator
    const indicatorSnapshot = this.indicatorPlugin.update(candleData);
    EventBus.publish(TradingEvent.INDICATOR_UPDATED, { robotId: this.id, snapshot: indicatorSnapshot });

    // 2. State Machine Logic
    switch (this.state) {
      case RobotState.WAIT_SIGNAL:
        this.evaluateSignal(candleData, indicatorSnapshot);
        break;
      
      case RobotState.SIGNAL_DETECTED:
      case RobotState.WAIT_RETRACEMENT:
        this.evaluateRetracement(candleData, indicatorSnapshot);
        break;
        
      case RobotState.POSITION_OPEN:
        // Handled by Exit Engine in real architecture, but we mock state change
        break;
    }
  }

  private evaluateSignal(candleData: any, indicatorSnapshot: any): void {
    const context: StrategyContext = {
      robotId: this.id,
      indicatorSnapshot,
      currentPrice: candleData.close
    };

    const signal = this.strategyPlugin.evaluate(context);
    
    if (signal !== 'NONE') {
      this.transitionTo(RobotState.SIGNAL_DETECTED, { side: signal, price: candleData.close });
      this.currentTimeoutCount = 0;
    }
  }

  private evaluateRetracement(candleData: any, indicatorSnapshot: any): void {
    // If timeout is 0, we never timeout
    if (this.maxTimeoutCandles > 0) {
      this.currentTimeoutCount++;
      if (this.currentTimeoutCount > this.maxTimeoutCandles) {
        EventBus.publish(TradingEvent.ENTRY_TIMEOUT, { robotId: this.id, reason: 'TIMEOUT' });
        this.transitionTo(RobotState.WAIT_SIGNAL);
        return;
      }
    }
    
    // Check if price is within retracement zone
    const inZone = this.checkRetracementZone(candleData.close, indicatorSnapshot);
    if (inZone) {
      this.transitionTo(RobotState.READY_TO_ENTER);
      this.executeOrder();
    }
  }

  private checkRetracementZone(currentPrice: number, snapshot: any): boolean {
    // Mock logic - in a real plugin this would be dynamic
    return true; // Assume it hit the zone
  }

  private async executeOrder(): Promise<void> {
    // Use Lock Manager to prevent duplicate execution
    const lockKey = `execute_${this.id}`;
    
    try {
      await LockManager.executeWithLock(lockKey, async () => {
        // Publish event for Risk Engine to calculate size and Provider to execute
        EventBus.publish(TradingEvent.READY_TO_ENTER, { robotId: this.id });
        
        // Mock successful execution
        EventBus.publish(TradingEvent.POSITION_OPENED, { robotId: this.id });
        this.transitionTo(RobotState.POSITION_OPEN);
      });
    } catch (e) {
      console.error(`[Robot ${this.id}] Locked: Cannot execute order concurrently.`);
    }
  }

  private transitionTo(newState: RobotState, payload?: any): void {
    console.log(`[Robot ${this.id}] Transition: ${this.state} -> ${newState}`);
    this.state = newState;
    
    // In a real system, persist this state to Database
  }
}
