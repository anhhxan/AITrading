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
    const { indicatorSnapshot, previousSnapshot, currentPrice, previousClose } = context;
    
    // FIX 4: Use persistent previousClose from context instead of serverless memory
    if (!indicatorSnapshot.ready || !previousSnapshot || previousClose === undefined || previousClose === null) {
      return { direction: 'NONE' };
    }

    const prevClose = previousClose;
    const currClose = currentPrice;
    
    const currB1 = indicatorSnapshot.line1;
    const currB2 = indicatorSnapshot.line2;
    const currB4 = indicatorSnapshot.line4;
    const currB5 = indicatorSnapshot.line5;

    const prevB1 = previousSnapshot.line1;
    const prevB2 = previousSnapshot.line2;
    const prevB4 = previousSnapshot.line4;
    const prevB5 = previousSnapshot.line5;

    let signal: SignalSide = 'NONE';
    console.log(`[BB_Strategy] prevClose=${prevClose}, currClose=${currClose}, currB4=${currB4}, currB2=${currB2}`);

    // LONG RULE:
    // Nến trước: Close nằm giữa Band 5 và Band 4
    // Nến hiện tại: Close đột phá qua Band 4 (hướng lên)
    if (prevClose >= prevB5 && prevClose <= prevB4 && currClose > currB4) {
      signal = 'LONG';
    }

    // SHORT RULE:
    // Nến trước: Close nằm giữa Band 1 và Band 2
    // Nến hiện tại: Close rớt xuống dưới Band 2 (hướng xuống)
    if (prevClose >= prevB2 && prevClose <= prevB1 && currClose < currB2) {
      signal = 'SHORT';
    }

    // Calculate trigger based on signal
    let entryTrigger;
    if (signal === 'LONG') {
      const distance = currB4 - currB5;
      const zoneValue = distance * (this.retracementZonePercent / 100);
      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: currB5,
        upper: currB5 + zoneValue
      };
    } else if (signal === 'SHORT') {
      const distance = currB1 - currB2;
      const zoneValue = distance * (this.retracementZonePercent / 100);
      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: currB1 - zoneValue,
        upper: currB1
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
