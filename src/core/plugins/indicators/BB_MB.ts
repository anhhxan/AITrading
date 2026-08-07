import { Candle, IIndicator } from '../../interfaces/PluginInterfaces';

export class BB_MB_Indicator implements IIndicator {
  public readonly name = 'BB_MB';
  
  private length: number = 20;
  private mult1: number = 2.0; // Outer bands (Band 4, Band 1)
  private mult2: number = 1.0; // Inner bands (Band 5, Band 2)
  
  private closeHistory: number[] = [];
  private currentEma: number | null = null;

  public init(params: Record<string, any>): void {
    if (params.length) this.length = params.length;
    if (params.mult) this.mult1 = params.mult;
    if (params.mult2) this.mult2 = params.mult2;
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

    // PineScript: basis = ta.ema(src, length)
    // Tính EMA
    const k = 2 / (this.length + 1);
    
    // Nếu chưa có EMA, dùng SMA của những cây nến đầu tiên làm EMA ban đầu
    if (this.currentEma === null) {
      const sum = this.closeHistory.reduce((a, b) => a + b, 0);
      this.currentEma = sum / this.length;
    } else {
      const currentClose = this.closeHistory[this.closeHistory.length - 1];
      this.currentEma = (currentClose - this.currentEma) * k + this.currentEma;
    }

    const basis = this.currentEma;

    // PineScript: dev = mult * ta.stdev(src, length)
    // Tính Standard Deviation (Stdev luôn dùng trung bình cộng SMA)
    const sum = this.closeHistory.reduce((a, b) => a + b, 0);
    const sma = sum / this.length;
    const squaredDiffs = this.closeHistory.map(price => Math.pow(price - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.length;
    const stdev = Math.sqrt(variance);

    // PineScript & User Convention: 
    // Band 1 = Upper Outer (basis + mult1 * stdev)
    // Band 2 = Upper Inner (basis + mult2 * stdev)
    // Band 3 = Basis (EMA)
    // Band 4 = Lower Inner (basis - mult2 * stdev)
    // Band 5 = Lower Outer (basis - mult1 * stdev)
    
    const band1 = basis + this.mult1 * stdev; 
    const band2 = basis + this.mult2 * stdev; 
    const band3 = basis;                      
    const band4 = basis - this.mult2 * stdev; 
    const band5 = basis - this.mult1 * stdev; 

    return {
      ready: true,
      band1,
      band2,
      band3,
      band4,
      band5,
      ema: basis,
      stdev
    };
  }
}
