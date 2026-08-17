import { IStrategy, SignalSide, StrategyContext } from '../../interfaces/PluginInterfaces';

export class BB_Strategy implements IStrategy {
  public readonly name = 'BB_Strategy';
  
  private retracementZonePercent: number = 20; // 20%
  private timeoutCandles: number = 3;

  public init(params: Record<string, any>): void {
    if (params.retracementZonePercent) this.retracementZonePercent = params.retracementZonePercent;
    if (params.timeoutCandles) this.timeoutCandles = params.timeoutCandles;
  }

  public evaluate(context: StrategyContext): any {
    const { indicatorSnapshot, currentPrice, previousClose } = context;
    
    // FIX 4: Use persistent previousClose from context instead of serverless memory
    if (!indicatorSnapshot.ready || previousClose === undefined || previousClose === null) {
      return { direction: 'NONE' };
    }

    const prevClose = previousClose;
    const currClose = currentPrice;
    
    const b1 = indicatorSnapshot.line1; // Upper Outer (Highest)
    const b2 = indicatorSnapshot.line2; // Upper Inner
    const b4 = indicatorSnapshot.line4; // Lower Inner
    const b5 = indicatorSnapshot.line5; // Lower Outer (Lowest)

    let signal: SignalSide = 'NONE';
    console.log(`[BB_Strategy] prevClose=${prevClose}, currClose=${currClose}, b5=${b5}, b4=${b4}, b2=${b2}, b1=${b1}`);

    // LONG RULE:
    // Nến trước: Close nằm giữa Band 5 và Band 4
    // Nến hiện tại: Close đột phá qua Band 4 (hướng lên)
    if (prevClose >= b5 && prevClose <= b4 && currClose > b4) {
      signal = 'LONG';
    }

    // SHORT RULE:
    // Nến trước: Close nằm giữa Band 1 và Band 2
    // Nến hiện tại: Close rớt xuống dưới Band 2 (hướng xuống)
    if (prevClose >= b2 && prevClose <= b1 && currClose < b2) {
      signal = 'SHORT';
    }

    // Calculate trigger based on signal
    let entryTrigger;
    if (signal === 'LONG') {
      const distance = b4 - b5;
      const zoneValue = distance * (this.retracementZonePercent / 100);
      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: b5,
        upper: b5 + zoneValue
      };
    } else if (signal === 'SHORT') {
      const distance = b1 - b2;
      const zoneValue = distance * (this.retracementZonePercent / 100);
      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: b1 - zoneValue,
        upper: b1
      };
    }

    // Removed state assignment because strategy is now stateless
    
    return {
      direction: signal,
      maxTimeoutCandles: this.timeoutCandles,
      entryTrigger
    };
  }
}
