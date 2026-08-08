import { Candle, IIndicator } from '../../interfaces/PluginInterfaces';

export class BB_MB_Indicator implements IIndicator {
  public readonly name = 'BB_MB';
  
  private length: number = 20;
  private mult1: number = 2.0; // Outer bands (Band 4, Band 1)
  private mult2: number = 1.0; // Inner bands (Band 5, Band 2)
  
  private closeHistory: number[] = [];
  private currentEma: number | null = null;

  public init(params: Record<string, any>): void {
    if (params.length !== undefined) this.length = params.length;
    if (params.mult !== undefined) this.mult1 = params.mult;
    if (params.mult2 !== undefined) this.mult2 = params.mult2;
  }

  public validate(): boolean {
    if (this.length <= 0) return false;
    if (this.mult1 <= 0 || this.mult2 <= 0) return false;
    return true;
  }

  public warmup(candles: Candle[]): void {
    for (const candle of candles) {
      this.update(candle);
    }
  }

  public update(candle: Candle): Record<string, any> {
    this.closeHistory.push(candle.close);
    
    // Maintain window size
    if (this.closeHistory.length > this.length) {
      this.closeHistory.shift();
    }

    return this.getSnapshot();
  }

  public getSnapshot(): Record<string, any> {
    if (this.closeHistory.length < this.length) {
      return { ready: false };
    }

    // PineScript: basis = sma(src, length)
    const sum = this.closeHistory.reduce((a, b) => a + b, 0);
    const basis = sum / this.length;

    // PineScript: dev = mult * stdev(src, length)
    // TradingView stdev divides by N (population stdev)
    const squaredDiffs = this.closeHistory.map(price => Math.pow(price - basis, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.length;
    const stdev = Math.sqrt(variance);

    const UpperOuter = basis + this.mult1 * stdev;
    const UpperInner = basis + this.mult2 * stdev;
    const Middle = basis;
    const LowerInner = basis - this.mult2 * stdev;
    const LowerOuter = basis - this.mult1 * stdev;

    // Bandwidth = (Upper - Lower) / Basis * 100
    const Bandwidth = ((UpperOuter - LowerOuter) / basis) * 100;
    
    // %B = (Current - Lower) / (Upper - Lower)
    const lastClose = this.closeHistory[this.closeHistory.length - 1];
    const PercentB = UpperOuter === LowerOuter ? 0 : (lastClose - LowerOuter) / (UpperOuter - LowerOuter);

    return {
      ready: true,
      UpperOuter,
      UpperInner,
      Middle,
      LowerInner,
      LowerOuter,
      Bandwidth,
      PercentB,
      stdev
    };
  }
}
