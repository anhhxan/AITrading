import { IStrategy, SignalSide, StrategyContext } from '../../interfaces/PluginInterfaces';

export class BB_Strategy implements IStrategy {
  public readonly name = 'BB_Strategy';
  
  public init(params: Record<string, any>): void {
  }

  public evaluate(context: StrategyContext): any {
    const { indicatorSnapshot, currentPrice } = context;
    
    if (!indicatorSnapshot || !indicatorSnapshot.ready) {
      return { direction: 'NONE' };
    }

    const currClose = currentPrice;
    
    // B1 = upper2, B2 = upper, B3 = basis, B4 = lower, B5 = lower2
    const B1 = indicatorSnapshot.line1!;
    const B2 = indicatorSnapshot.line2!;
    const B3 = indicatorSnapshot.line3!;
    const B4 = indicatorSnapshot.line4!;
    const B5 = indicatorSnapshot.line5!;

    let signal: SignalSide = 'NONE';
    let armBounds = undefined;
    let entryTrigger = undefined;
    let cancelTrigger = undefined;

    // LONG CANDIDATE: Candle A dng n?m trong B5 -> B4
    if (currClose >= B5 && currClose <= B4) {
      signal = 'LONG';
      const triggerValue = B4 + (B3 - B4) * 0.10;
      
      armBounds = {
        lower: B4,
        upper: B3
      };

      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: 0,
        upper: triggerValue
      };
      
      cancelTrigger = {
        type: 'OUT_OF_BOUNDS',
        value: 0
      };
    }
    // SHORT CANDIDATE: Candle A dng n?m trong B2 -> B1
    else if (currClose >= B2 && currClose <= B1) {
      signal = 'SHORT';
      const triggerValue = B2 - (B2 - B3) * 0.10;
      
      armBounds = {
        lower: B3,
        upper: B2
      };

      entryTrigger = {
        type: 'RETRACEMENT_ZONE',
        lower: triggerValue,
        upper: 999999999
      };
      
      cancelTrigger = {
        type: 'OUT_OF_BOUNDS',
        value: 0
      };
    }

    if (signal === 'NONE') {
      return { direction: 'NONE' };
    }

    return {
      direction: signal,
      persistent: true,
      armBounds,
      entryTrigger,
      cancelTrigger
    };
  }
}
