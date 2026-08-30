export interface StrategyContext {
  robotId: string;
  indicatorSnapshot: Record<string, any>;
  previousSnapshot?: Record<string, any> | null;
  currentPrice: number;
  currentHigh: number;
  currentLow: number;
  previousClose?: number | null; 
}

export type SignalSide = 'LONG' | 'SHORT' | 'NONE';

export interface IStrategy {
  readonly name: string;
  init(params: Record<string, any>): void;
  evaluate(context: StrategyContext): {
    direction: SignalSide;
    maxTimeoutCandles?: number;
    persistent?: boolean;
    entryTrigger?: { type: string; lower: number; upper: number };
    cancelTrigger?: { type: string; value: number };
  };
}
