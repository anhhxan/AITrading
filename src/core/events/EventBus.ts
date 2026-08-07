import { EventEmitter } from 'events';

/**
 * Defines the core events in the Trading AI Platform.
 */
export enum TradingEvent {
  // Market Data Events
  TICK_RECEIVED = 'TICK_RECEIVED',
  CANDLE_CLOSED = 'CANDLE_CLOSED',
  
  // Indicator Events
  INDICATOR_UPDATED = 'INDICATOR_UPDATED',
  
  // Strategy Events
  SIGNAL_DETECTED = 'SIGNAL_DETECTED',
  
  // Signal Engine / State Machine Events
  READY_TO_ENTER = 'READY_TO_ENTER',
  ENTRY_TIMEOUT = 'ENTRY_TIMEOUT',
  
  // Risk & Execution Events
  ORDER_APPROVED = 'ORDER_APPROVED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  POSITION_OPENED = 'POSITION_OPENED',
  POSITION_CLOSED = 'POSITION_CLOSED',
  
  // Exit Engine Events
  CLOSE_POSITION = 'CLOSE_POSITION',
  
  // System Events
  ROBOT_STARTED = 'ROBOT_STARTED',
  ROBOT_STOPPED = 'ROBOT_STOPPED',
  ROBOT_ERROR = 'ROBOT_ERROR',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE'
}

/**
 * EventBus acts as the central nervous system of the Trading Platform.
 * All engines communicate by publishing and subscribing to events.
 */
class EventBusService extends EventEmitter {
  constructor() {
    super();
    // Allow a high number of listeners since multiple robots/engines will subscribe
    this.setMaxListeners(100);
  }

  /**
   * Type-safe emit wrapper
   */
  public publish(event: TradingEvent, payload: any): void {
    // Optionally we can log every event to the System Logs here
    // console.debug(`[EventBus] Emitting ${event}`, payload);
    this.emit(event, payload);
  }

  /**
   * Type-safe subscribe wrapper
   */
  public subscribe(event: TradingEvent, listener: (...args: any[]) => void): void {
    this.on(event, listener);
  }

  /**
   * Type-safe unsubscribe wrapper
   */
  public unsubscribe(event: TradingEvent, listener: (...args: any[]) => void): void {
    this.off(event, listener);
  }
}

// Export as a singleton
export const EventBus = new EventBusService();
