import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { EventFactory } from '../../infrastructure/EventFactory';
import { coreEventBus } from '../../infrastructure/EventBus';

// We will test BB_Strategy logic manually here as requested by audit test
import { BB_Strategy } from '../../plugins/strategies/BB_Strategy';
import { StateMachineEngine, RobotState } from '../../engine/runtime/StateMachineEngine';

describe('Paper Trading Entry Audit Test', () => {
  let strategy: BB_Strategy;
  let stateMachine: StateMachineEngine;

  beforeAll(async () => {
    strategy = new BB_Strategy();
    strategy.init({});
    stateMachine = new StateMachineEngine();
    await stateMachine.initialize();
  });

  afterAll(async () => {
    await stateMachine.shutdown();
  });

  beforeEach(() => {
    stateMachine.registerRobot('test-robot');
  });

  it('LONG Entry Rule Logic', () => {
    const b5 = 90;
    const b4 = 100;
    const b3 = 110;
    
    // 1. Previous candle closes between b5 and b4
    strategy.evaluate({
      robotId: 'test',
      indicatorSnapshot: { ready: true, line1: 130, line2: 120, line3: b3, line4: b4, line5: b5 },
      currentPrice: 95 // Between b5 and b4
    });

    // 2. Current candle breaks above b4
    const result = strategy.evaluate({
      robotId: 'test',
      indicatorSnapshot: { ready: true, line1: 130, line2: 120, line3: b3, line4: b4, line5: b5 },
      currentPrice: 105 // Above b4
    });

    expect(result.direction).toBe('LONG');
    expect(result.entryTrigger).toBeDefined();
    
    // Trigger zone = 20% of distance between b4 (100) and b5 (90) = 10 * 0.2 = 2
    // Lower = b5 = 90
    // Upper = 90 + 2 = 92
    expect(result.entryTrigger.lower).toBe(90);
    expect(result.entryTrigger.upper).toBe(92);
  });

  it('SHORT Entry Rule Logic', () => {
    const b1 = 110;
    const b2 = 100;
    const b3 = 90;
    
    // 1. Previous candle closes between b2 and b1
    strategy.evaluate({
      robotId: 'test',
      indicatorSnapshot: { ready: true, line1: b1, line2: b2, line3: b3, line4: 80, line5: 70 },
      currentPrice: 105 // Between b2 and b1
    });

    // 2. Current candle drops below b2
    const result = strategy.evaluate({
      robotId: 'test',
      indicatorSnapshot: { ready: true, line1: b1, line2: b2, line3: b3, line4: 80, line5: 70 },
      currentPrice: 95 // Below b2
    });

    expect(result.direction).toBe('SHORT');
    expect(result.entryTrigger).toBeDefined();
    
    // Trigger zone = 20% of distance between b1 (110) and b2 (100) = 10 * 0.2 = 2
    // Lower = 110 - 2 = 108
    // Upper = 110
    expect(result.entryTrigger.lower).toBe(108);
    expect(result.entryTrigger.upper).toBe(110);
  });
});
