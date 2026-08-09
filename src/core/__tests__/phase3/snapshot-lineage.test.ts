import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StrategyEngine } from '../../engine/strategies/StrategyEngine';
import { StateMachineEngine } from '../../engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

describe('Phase 3: Snapshot Lineage Regression', () => {
  let strategyEngine: StrategyEngine;
  let stateMachineEngine: StateMachineEngine;
  
  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    strategyEngine = new StrategyEngine();
    stateMachineEngine = new StateMachineEngine();
    await strategyEngine.initialize();
    await stateMachineEngine.initialize();
    
    strategyEngine.registerRobot('RobotL1', 'BB_Strategy', { retracementZonePercent: 20, maxTimeoutCandles: 5 });
    stateMachineEngine.registerRobot('RobotL1');
  });

  afterEach(async () => {
    await strategyEngine.shutdown();
    await stateMachineEngine.shutdown();
  });

  it('L1: STRATEGY_SIGNAL_EVENT must preserve original BB_MB Line 1-5 snapshot across candles', async () => {
    let capturedSignal: any = null;
    let transitionEvent: any = null;
    
    coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', async (evt: any) => {
      capturedSignal = evt;
    });

    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (evt: any) => {
      if (evt.newState === 'READY_TO_ENTER') {
        transitionEvent = evt;
      }
    });

    let seq = 1;
    const sendCandle = async (closePrice: number, line4: number, line5: number) => {
      const trace = EventFactory.createTrace('trace_1', 'p1', 'ext', seq++);
      
      // Send Candle FIRST to update StrategyEngine's currentPrices
      await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotL1', trace, {
        candle: { timestamp: seq * 1000, open: closePrice, high: closePrice, low: closePrice, close: closePrice, volume: 1 }
      }) as any);
      
      // Send Indicator Snapshot SECOND to trigger Strategy evaluate
      await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotL1', trace, {
        indicators: {
          BB_MB: { 
            ready: true, 
            config: { length: 20, source: 'close', mult: 2, mult2: 1 },
            line1: 150, line2: 130, line3: 100, line4: line4, line5: line5 
          }
        }
      }) as any);
      
      await coreEventBus.waitForIdle('RobotL1');
    };

    // Warmup candle to set previousClose = 95
    await sendCandle(95, 100, 90);
    
    // Candle #22: price breaks above line 4 (105 > 100) -> LONG Signal
    await sendCandle(105, 100, 90);
    
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal.direction).toBe('LONG');
    expect(capturedSignal.indicatorReference).toBeDefined();
    expect(capturedSignal.indicatorReference.snapshot.line5).toBe(90);
    
    // Candle #23: indicator line5 moves to 95, price moves to 102
    await sendCandle(102, 100, 95);
    
    // Candle #24: price drops into retracement zone (trigger lower=90, upper=92 for 20% of 10)
    // Wait, zone value = (100 - 90) * 0.2 = 2.
    // Retracement zone = lower: 90, upper: 92.
    // Let's send price 91 to trigger READY_TO_ENTER.
    await sendCandle(91, 100, 95);
    
    expect(transitionEvent).not.toBeNull();
    expect(transitionEvent.newState).toBe('READY_TO_ENTER');
    
    // Check StateMachine internal state
    const activeSignal = (stateMachineEngine as any).activeSignals.get('RobotL1');
    expect(activeSignal).toBeDefined();
    
    // MUST STILL BE 90 (from Candle #22), not 95!
    expect(activeSignal.indicatorReference.snapshot.line5).toBe(90);
  });
});
