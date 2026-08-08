import { describe, it, expect } from 'vitest';
import { PluginLoader } from '../../engine/runtime/PluginLoader';
import { IStrategy, StrategyContext, SignalSide } from '../../interfaces/PluginInterfaces';

class CrashStrategy implements IStrategy {
  name = 'CrashStrategy';
  init() {}
  evaluate(context: StrategyContext): SignalSide {
    throw new Error('Crash from strategy');
  }
}

describe('Phase 3: Plugin Isolation (Strategy)', () => {
  it('I2: Strategy Crash không sập hệ thống', () => {
    const strat = new CrashStrategy();
    const result = PluginLoader.safeEvaluateStrategy(strat, { robotId: 'R1', indicatorSnapshot: {}, currentPrice: 100 });
    
    expect(result).toBe('ERROR');
  });
});
