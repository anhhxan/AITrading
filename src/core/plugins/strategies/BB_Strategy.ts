import { IStrategy, SignalSide, StrategyContext } from '../../interfaces/PluginInterfaces';

export class BB_Strategy implements IStrategy {
  public readonly name = 'BB_Strategy';
  
  private retracementZonePercent: number = 20; // 20%
  private timeoutCandles: number = 3;
  
  // To track previous candle for logic evaluation
  private previousClose: number | null = null;

  public init(params: Record<string, any>): void {
    if (params.retracementZonePercent) this.retracementZonePercent = params.retracementZonePercent;
    if (params.timeoutCandles) this.timeoutCandles = params.timeoutCandles;
  }

  public evaluate(context: StrategyContext): SignalSide {
    const { indicatorSnapshot, currentPrice } = context;
    
    // Need enough data
    if (!indicatorSnapshot.ready || this.previousClose === null) {
      this.previousClose = currentPrice;
      return 'NONE';
    }

    const prevClose = this.previousClose;
    const currClose = currentPrice;
    
    const b1 = indicatorSnapshot.band1; // Upper Outer (Highest)
    const b2 = indicatorSnapshot.band2; // Upper Inner
    const b4 = indicatorSnapshot.band4; // Lower Inner
    const b5 = indicatorSnapshot.band5; // Lower Outer (Lowest)

    let signal: SignalSide = 'NONE';

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

    // Save current close for next iteration
    this.previousClose = currClose;
    
    return signal;
  }
  
  /**
   * Helper function used by the Signal Engine to determine if price hit the Entry Zone.
   */
  public isPriceInRetracementZone(side: SignalSide, currentPrice: number, snapshot: any): boolean {
    if (side === 'LONG') {
      const b4 = snapshot.band4;
      const b5 = snapshot.band5;
      const distance = b4 - b5; // b4 is higher than b5
      const zoneValue = distance * (this.retracementZonePercent / 100);
      
      // Entry Zone for LONG: from Band5 up to (Band5 + zoneValue)
      const entryZoneBottom = b5;
      const entryZoneTop = b5 + zoneValue;
      
      return currentPrice >= entryZoneBottom && currentPrice <= entryZoneTop;
    } 
    else if (side === 'SHORT') {
      const b1 = snapshot.band1;
      const b2 = snapshot.band2;
      const distance = b1 - b2; // b1 is higher than b2
      const zoneValue = distance * (this.retracementZonePercent / 100);
      
      // Entry Zone for SHORT: from Band1 down to (Band1 - zoneValue)
      // Since it's a SHORT, we want price to retrace up towards Band1
      const entryZoneTop = b1;
      const entryZoneBottom = b1 - zoneValue;
      
      return currentPrice <= entryZoneTop && currentPrice >= entryZoneBottom;
    }
    
    return false;
  }
}
