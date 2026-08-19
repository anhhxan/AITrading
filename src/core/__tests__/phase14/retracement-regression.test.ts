import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateMachineEngine, RobotState } from '../../engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

describe('Phase 14H - Retracement Regression', () => {
  let engine: StateMachineEngine;

  beforeEach(async () => {
    coreEventBus.clearAll();
    coreIdempotencyStore.clear();
    engine = new StateMachineEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  const runScenario = async (
    direction: 'LONG' | 'SHORT',
    open: number,
    high: number,
    low: number,
    close: number
  ) => {
    const robotId = 'regression-robot';
    engine.registerRobot(robotId);

    // 1. Send Signal
    const trace = EventFactory.createTrace('corr-1', 'parent-1', 'tester', 1);
    const signalEvent = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, 1, trace, {
      direction,
      entryTrigger: { type: 'RETRACEMENT_ZONE', lower: 64000, upper: 64020 }
    });
    
    await coreEventBus.publish(signalEvent as any);
    await coreEventBus.waitForIdle(robotId);

    // Capture transitions
    let transition: any = null;
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => {
      if (e.newState === RobotState.READY_TO_ENTER) {
        transition = e;
      }
    });

    // 2. Send Trigger Candle
    const candleTrace = EventFactory.createTrace('corr-1', 'parent-2', 'tester', 2);
    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, candleTrace, {
      candle: { open, high, low, close, volume: 100, timestamp: Date.now() }
    });
    
    await coreEventBus.publish(candleEvent as any);
    await coreEventBus.waitForIdle(robotId);

    return transition;
  };

  describe('LONG Regression', () => {
    it('Normal - should HIT 64020', async () => {
      const res = await runScenario('LONG', 64050, 64080, 64010, 64050);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64020);
    });
    it('Deep - should HIT 64020', async () => {
      const res = await runScenario('LONG', 64050, 64050, 64000, 64050);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64020);
    });
    it('Cross zone - should HIT 64020', async () => {
      const res = await runScenario('LONG', 64050, 64050, 63900, 64050);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64020);
    });
    it('No retracement - should MISS', async () => {
      const res = await runScenario('LONG', 64050, 64100, 64030, 64050);
      expect(res).toBeNull();
    });
    it('Open inside - should HIT 64010', async () => {
      const res = await runScenario('LONG', 64010, 64015, 64005, 64010);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64010);
    });
    it('Open below zone - should MISS', async () => {
      const res = await runScenario('LONG', 63900, 63950, 63800, 63900);
      expect(res).toBeNull();
    });
    it('Boundary open=lower - should HIT 64000', async () => {
      const res = await runScenario('LONG', 64000, 64020, 63990, 64000);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64000); // Math.min(64000, 64020) = 64000
    });
    it('Boundary low=upper - should HIT 64020', async () => {
      const res = await runScenario('LONG', 64050, 64050, 64020, 64050);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64020);
    });
  });

  describe('SHORT Regression', () => {
    it('Normal - should HIT 64000', async () => {
      const res = await runScenario('SHORT', 63900, 64010, 63850, 63900);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64000);
    });
    it('Deep - should HIT 64000', async () => {
      const res = await runScenario('SHORT', 63900, 64020, 63900, 63900);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64000);
    });
    it('Cross zone - should HIT 64000', async () => {
      const res = await runScenario('SHORT', 63900, 64100, 63900, 63900);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64000);
    });
    it('No retracement - should MISS', async () => {
      const res = await runScenario('SHORT', 63900, 63950, 63800, 63900);
      expect(res).toBeNull();
    });
    it('Open inside - should HIT 64010', async () => {
      const res = await runScenario('SHORT', 64010, 64015, 63990, 64010);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64010);
    });
    it('Open above zone - should MISS', async () => {
      const res = await runScenario('SHORT', 64050, 64100, 64030, 64050);
      expect(res).toBeNull();
    });
    it('Boundary open=upper - should HIT 64020', async () => {
      const res = await runScenario('SHORT', 64020, 64020, 64000, 64020);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64020); // Math.max(64020, 64000) = 64020
    });
    it('Boundary high=lower - should HIT 64000', async () => {
      const res = await runScenario('SHORT', 63900, 64000, 63900, 63900);
      expect(res).not.toBeNull();
      expect(res.triggerPrice).toBe(64000);
    });
  });
});
