/**
 * Core Interfaces for the Trading AI Platform Plugins.
 * This guarantees the system can expand without modifying the Core Engines.
 */

// ==========================================
// 1. DATA TYPES
// ==========================================
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalSide = 'LONG' | 'SHORT' | 'NONE';

// ==========================================
// 2. INDICATOR INTERFACE
// ==========================================
export interface IIndicator {
  /** Name of the indicator plugin (e.g., 'BB_MB', 'HARSI') */
  readonly name: string;
  
  /** Initialize with JSON parameters */
  init(params: Record<string, any>): void;
  
  /** Update with a new candle and return computed values snapshot */
  update(candle: Candle): Record<string, any>;
  
  /** Get the current snapshot of indicator values */
  getSnapshot(): Record<string, any>;
}

// ==========================================
// 3. STRATEGY INTERFACE
// ==========================================
export interface StrategyContext {
  robotId: string;
  indicatorSnapshot: Record<string, any>;
  currentPrice: number;
  // Other contextual data can be passed here
}

export interface IStrategy {
  /** Name of the strategy plugin (e.g., 'BB_Strategy') */
  readonly name: string;
  
  /** Initialize with JSON parameters */
  init(params: Record<string, any>): void;
  
  /** Evaluate the market and return LONG/SHORT signal if conditions met */
  evaluate(context: StrategyContext): SignalSide;
}

// ==========================================
// 4. RISK & EXIT INTERFACES
// ==========================================
export interface IRiskProfile {
  readonly name: string;
  init(params: Record<string, any>): void;
  /** Returns the approved amount/size, or 0 if rejected */
  calculateSize(balance: number, price: number): number;
}

export interface IExitProfile {
  readonly name: string;
  init(params: Record<string, any>): void;
  /** Evaluate if a position should be closed */
  shouldExit(currentPrice: number, entryPrice: number, side: SignalSide): boolean;
}

// ==========================================
// 5. PROVIDER INTERFACE
// ==========================================
export interface IProvider {
  readonly name: string; // e.g., 'BINANCE_FUTURES', 'MT5'
  
  connect(credentials: Record<string, any>): Promise<void>;
  
  buy(symbol: string, amount: number): Promise<{ price: number; id: string }>;
  sell(symbol: string, amount: number): Promise<{ price: number; id: string }>;
  close(symbol: string): Promise<void>;
  
  getPosition(symbol: string): Promise<any>;
  getBalance(): Promise<number>;
}
