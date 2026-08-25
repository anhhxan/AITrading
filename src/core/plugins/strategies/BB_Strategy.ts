import { IStrategy, SignalSide, StrategyContext } from '../../interfaces/PluginInterfaces';

export class BB_Strategy implements IStrategy {
  public readonly name = 'BB_Strategy';
  
  private retracementZonePercent: number = 10; // 10%
  private timeoutCandles: number = 3;

  public init(params: Record<string, any>): void {
    if (params.retracementZonePercent) this.retracementZonePercent = params.retracementZonePercent;
    if (params.timeoutCandles) this.timeoutCandles = params.timeoutCandles;
  }

  public evaluate(context: StrategyContext): any {
    const { indicatorSnapshot, previousSnapshot, currentPrice, currentHigh, currentLow, previousClose } = context;
    
    // FIX 4: Use persistent previousClose from context instead of serverless memory
    if (!indicatorSnapshot.ready || !previousSnapshot || previousClose === undefined || previousClose === null) {
      return { direction: 'NONE' };
    }

    const prevClose = previousClose;
    const currClose = currentPrice;
    
    const currB1 = indicatorSnapshot.line1;
    const currB2 = indicatorSnapshot.line2;
    const currB3 = indicatorSnapshot.line3;
    const currB4 = indicatorSnapshot.line4;
    const currB5 = indicatorSnapshot.line5;

    const prevB1 = previousSnapshot.line1;
    const prevB2 = previousSnapshot.line2;
    const prevB4 = previousSnapshot.line4;
    const prevB5 = previousSnapshot.line5;

    let signal: SignalSide = 'NONE';
    console.log(`[BB_Strategy] prevClose=${prevClose}, currHigh=${currentHigh}, currLow=${currentLow}, currB4=${currB4}, currB3=${currB3}, currB2=${currB2}`);

    // LONG RULE:
    // Bước 1: Previous candle nằm trong B5 -> B4
    // Bước 2: Candle tiếp theo (hiện tại) phải nằm hoàn toàn trong B3 -> B4 (currHigh <= B4 AND currLow >= B3)
    if (prevClose >= prevB5 && prevClose <= prevB4 && currentHigh <= currB4 && currentLow >= currB3) {
      signal = 'LONG';
    }

    // SHORT RULE:
    // Bước 1: Previous candle nằm trong B1 -> B2
    // Bước 2: Candle tiếp theo (hiện tại) phải nằm hoàn toàn trong B2 -> B3 (currHigh <= B3 AND currLow >= B2)
    if (prevClose >= prevB2 && prevClose <= prevB1 && currentLow >= currB2 && currentHigh <= currB3) {
      signal = 'SHORT';
    }

    // Calculate trigger based on signal
    let entryTrigger;
    if (signal === 'LONG') {
      // Vùng 10% sát B4: B4 - 10% * (B4 - B3) -> B4
      const distance = currB4 - currB3;
      const zoneValue = distance * (this.retracementZonePercent / 100);
      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: currB4 - zoneValue,
        upper: currB4
      };
    } else if (signal === 'SHORT') {
      // Vùng 10% sát B2: B2 -> B2 + 10% * (B3 - B2)
      const distance = currB3 - currB2;
      const zoneValue = distance * (this.retracementZonePercent / 100);
      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: currB2,
        upper: currB2 + zoneValue
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
