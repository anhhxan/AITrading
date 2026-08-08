import { Candle, IIndicator } from '../../interfaces/PluginInterfaces';

export class BB_MB_Indicator implements IIndicator {
  public readonly name = 'BB_MB';
  
  private length: number = 20;
  private source: string = 'close';
  private mult1: number = 2.0; // Outer bands (Band 4, Band 1)
  private mult2: number = 1.0; // Inner bands (Band 5, Band 2)
  
  private valueHistory: number[] = [];

  public init(params: Record<string, any>): void {
    if (params.length !== undefined) this.length = params.length;
    if (params.source !== undefined) this.source = params.source;
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

  public update(candle: Candle): any {
    const val = (candle as any)[this.source] !== undefined ? (candle as any)[this.source] : candle.close;
    this.valueHistory.push(val);
    
    // Maintain window size
    if (this.valueHistory.length > this.length) {
      this.valueHistory.shift();
    }

    return this.getSnapshot();
  }

  public getSnapshot(): any {
    const config = {
      length: this.length,
      source: this.source,
      mult: this.mult1,
      mult2: this.mult2
    };

    if (this.valueHistory.length < this.length) {
      return { 
        ready: false,
        config,
        line1: null,
        line2: null,
        line3: null,
        line4: null,
        line5: null
      };
    }

    // PineScript: basis = sma(src, length)
    const sum = this.valueHistory.reduce((a, b) => a + b, 0);
    const basis = sum / this.length;

    // PineScript: dev = mult * stdev(src, length)
    // TradingView stdev divides by N (population stdev)
    const squaredDiffs = this.valueHistory.map(price => Math.pow(price - basis, 2));
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
    const lastValue = this.valueHistory[this.valueHistory.length - 1];
    const PercentB = UpperOuter === LowerOuter ? 0 : (lastValue - LowerOuter) / (UpperOuter - LowerOuter);

    return {
      ready: true,
      config,
      line1: UpperOuter,
      line2: UpperInner,
      line3: Middle,
      line4: LowerInner,
      line5: LowerOuter,
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

  public shutdown(): void {
    this.valueHistory = [];
  }
}
