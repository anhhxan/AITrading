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
    const currHigh = context.currentHigh;
    const currLow = context.currentLow;
    
    // B1 = upper2, B2 = upper, B3 = basis, B4 = lower, B5 = lower2
    const B1 = indicatorSnapshot.line1!;
    const B2 = indicatorSnapshot.line2!;
    const B3 = indicatorSnapshot.line3!;
    const B4 = indicatorSnapshot.line4!;
    const B5 = indicatorSnapshot.line5!;

    // Quy tac 1: Dong cua trong vung ngoai. Quy tac 2: Rut chan (Wick) vao vung ngoai nhung dong cua o vung trong
    const isLongRule1 = (currClose >= B5 && currClose <= B4);
    const isLongRule2 = (currLow <= B4 && currClose > B4 && currClose <= B3);
    const isLongCandidate = isLongRule1 || isLongRule2;

    const isShortRule1 = (currClose >= B2 && currClose <= B1);
    const isShortRule2 = (currHigh >= B2 && currClose < B2 && currClose >= B3);
    const isShortCandidate = isShortRule1 || isShortRule2;

    let signal: SignalSide = 'NONE';
    let armBounds = undefined;
    let entryTrigger = undefined;
    let cancelBounds = undefined;

    // LONG CANDIDATE
    if (isLongCandidate) {
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
      
      cancelBounds = {
        lower: B5,
        upper: 999999999
      };
    }
    // SHORT CANDIDATE
    else if (isShortCandidate) {
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
      
      cancelBounds = {
        lower: 0,
        upper: B1
      };
    }

    if (signal === 'NONE') {
      return { direction: 'NONE' };
    }

    return {
      direction: signal,
      persistent: true,
      armBounds,
      cancelBounds,
      entryTrigger
    };
  }
}
