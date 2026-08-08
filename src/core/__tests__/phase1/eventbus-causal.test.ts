import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../infrastructure/EventBus';
import { EventFactory, BaseEvent } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

const ROBOT = 'ROBOT_TEST';

describe('EventBus Causal Pipeline Ordering (T1-T9)', () => {
  let eventBus: EventBus;
  let processingOrder: string[] = [];
  
  beforeEach(() => {
    eventBus = new EventBus();
    coreIdempotencyStore.clear();
    processingOrder = [];
  });

  afterEach(async () => {
    await eventBus.shutdown();
    eventBus.clearAll();
  });

  it('T1 - Causal priority', async () => {
    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      processingOrder.push(`CANDLE${e.trace.sequence}`);
      if (e.trace.sequence === 20) {
        // Mock IndicatorEngine emitting INDICATOR 20
        const indicatorEvent = EventFactory.createEvent('INDICATOR_UPDATED', ROBOT, {
          ...e.trace, // Same sequence 20
        }, {});
        await eventBus.publish(indicatorEvent);
      }
    });

    eventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      processingOrder.push(`INDICATOR${e.trace.sequence}`);
    });

    const candle20 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c1', 'root', 'Market', 20), {});
    const candle21 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c1', 'root', 'Market', 21), {});

    await eventBus.publish(candle20);
    await eventBus.publish(candle21);

    await eventBus.waitForIdle(ROBOT);

    expect(processingOrder).toEqual(['CANDLE20', 'INDICATOR20', 'CANDLE21']);
  });

  it('T2 - Full chain', async () => {
    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      processingOrder.push(`CANDLE${e.trace.sequence}`);
      if (e.trace.sequence === 20) {
        const evt = EventFactory.createEvent('INDICATOR_UPDATED', ROBOT, { ...e.trace }, {});
        await eventBus.publish(evt);
      }
    });

    eventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      processingOrder.push(`INDICATOR${e.trace.sequence}`);
      const evt = EventFactory.createEvent('STRATEGY_SIGNAL', ROBOT, { ...e.trace }, {});
      await eventBus.publish(evt);
    });

    eventBus.subscribe('STRATEGY_SIGNAL', async (e) => {
      processingOrder.push(`STRATEGY${e.trace.sequence}`);
      const evt = EventFactory.createEvent('STATE_UPDATED', ROBOT, { ...e.trace }, {});
      await eventBus.publish(evt);
    });

    eventBus.subscribe('STATE_UPDATED', async (e) => {
      processingOrder.push(`STATE${e.trace.sequence}`);
    });

    const candle20 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c2', 'root', 'Market', 20), {});
    const candle21 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c2', 'root', 'Market', 21), {});

    // Sync publish to queue them both before processing completes
    await eventBus.publish(candle20);
    await eventBus.publish(candle21);

    await eventBus.waitForIdle(ROBOT);

    expect(processingOrder).toEqual([
      'CANDLE20',
      'INDICATOR20',
      'STRATEGY20',
      'STATE20',
      'CANDLE21'
    ]);
  });

  it('T3 - 100 candles pipeline ordering', async () => {
    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      processingOrder.push(`CANDLE${e.trace.sequence}`);
      const evt = EventFactory.createEvent('INDICATOR_UPDATED', ROBOT, { ...e.trace }, {});
      await eventBus.publish(evt);
    });

    eventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      processingOrder.push(`INDICATOR${e.trace.sequence}`);
    });

    // publish 100 candles very fast
    for (let i = 1; i <= 100; i++) {
      const candle = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c3', 'root', 'Market', i), {});
      await eventBus.publish(candle); // Fire and forget inside
    }

    await eventBus.waitForIdle(ROBOT);

    // Verify ordering
    const expected = [];
    for (let i = 1; i <= 100; i++) {
      expected.push(`CANDLE${i}`);
      expected.push(`INDICATOR${i}`);
    }

    expect(processingOrder).toEqual(expected);
  });

  it('T4 - Future event không được chen vào causal pipeline', async () => {
    // When CANDLE20 is processing, even if CANDLE21 and CANDLE22 are published, INDICATOR20 runs first
    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      processingOrder.push(`CANDLE${e.trace.sequence}`);
      
      if (e.trace.sequence === 20) {
        // Publish next external events while CANDLE 20 is still executing
        const candle21 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c4', 'root', 'Market', 21), {});
        const candle22 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c4', 'root', 'Market', 22), {});
        await eventBus.publish(candle21);
        await eventBus.publish(candle22);

        // Then publish the internal event
        const ind = EventFactory.createEvent('INDICATOR_UPDATED', ROBOT, { ...e.trace }, {});
        await eventBus.publish(ind);
      }
    });

    eventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      processingOrder.push(`INDICATOR${e.trace.sequence}`);
    });

    const candle20 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c4', 'root', 'Market', 20), {});
    await eventBus.publish(candle20);

    await eventBus.waitForIdle(ROBOT);

    expect(processingOrder).toEqual(['CANDLE20', 'INDICATOR20', 'CANDLE21', 'CANDLE22']);
  });

  it('T5 - Stale Event bị reject', async () => {
    // Setup expected sequence = 20 by processing seq=19
    const candle19 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c5', 'root', 'Market', 19), {});
    await eventBus.publish(candle19);
    await eventBus.waitForIdle(ROBOT);
    
    // Now publish seq=18 (stale)
    const candle18 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c5', 'root', 'Market', 18), {});
    await eventBus.publish(candle18);
    await eventBus.waitForIdle(ROBOT);

    // It should be rejected (processingOrder length = 0 since we didn't subscribe, but we can subscribe to check)
    let processedStale = false;
    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      if (e.trace.sequence === 18) processedStale = true;
    });

    // publish again just to be sure
    const candle18_2 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c5', 'root', 'Market', 18), { id: 'x' });
    await eventBus.publish(candle18_2);
    await eventBus.waitForIdle(ROBOT);

    expect(processedStale).toBe(false);
  });

  it('T6 - Future Event (Out of order) bị giữ trong pending queue', async () => {
    let processed21 = false;
    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      if (e.trace.sequence === 21) processed21 = true;
    });

    // publish seq 21 while expected is 20 (since nothing published yet, if we publish 20 then 21)
    const candle21 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c6', 'root', 'Market', 21), {});
    await eventBus.publish(candle21); // Expected is 21 since it sets it to first event seen!
    
    // Wait, EventBus sets expectedSequence = event.sequence on FIRST publish!
    // So if we publish 21 first, expected becomes 21!
    // Let's establish expected = 20 first.
    eventBus.clearAll();
    const eventBusNew = new EventBus();
    const c20 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c6_2', 'root', 'Market', 20), {});
    await eventBusNew.publish(c20);
    await eventBusNew.waitForIdle(ROBOT); // expected is now 21
    
    let processed22 = false;
    eventBusNew.subscribe('CANDLE_CLOSED', async (e) => {
      if (e.trace.sequence === 22) processed22 = true;
    });

    // publish 22 (expected 21 -> out of order, pending)
    const c22 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c6_2', 'root', 'Market', 22), {});
    await eventBusNew.publish(c22);
    await eventBusNew.waitForIdle(ROBOT);
    
    expect(processed22).toBe(false); // Should be pending
    
    // Publish 21, should flush 22
    const c21 = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, EventFactory.createTrace('c6_2', 'root', 'Market', 21), {});
    await eventBusNew.publish(c21);
    await eventBusNew.waitForIdle(ROBOT);

    expect(processed22).toBe(true);
  });

  it('T7 - Causal Event không bị Idempotency reject', async () => {
    let callCount = 0;
    eventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      callCount++;
    });
    eventBus.subscribe('STRATEGY_SIGNAL', async (e) => {
      callCount++;
    });

    const trace = EventFactory.createTrace('c7', 'root', 'Market', 20);
    const ind = EventFactory.createEvent('INDICATOR_UPDATED', ROBOT, trace, {});
    const strat = EventFactory.createEvent('STRATEGY_SIGNAL', ROBOT, trace, {});

    // They have same sequence=20, but different eventType -> idempotencyKey is different!
    await eventBus.publish(ind);
    await eventBus.publish(strat);
    await eventBus.waitForIdle(ROBOT);

    expect(callCount).toBe(2);
  });

  it('T9 - Parent/Causality', async () => {
    let capturedIndicator: any = null;
    let capturedStrategy: any = null;
    let capturedCandle: any = null;

    eventBus.subscribe('CANDLE_CLOSED', async (e) => {
      capturedCandle = e;
      const trace = EventFactory.createTrace(e.trace.correlationId, e.eventId, 'IndicatorEngine', e.trace.sequence);
      const ind = EventFactory.createEvent('INDICATOR_UPDATED', ROBOT, trace, {});
      await eventBus.publish(ind);
    });

    eventBus.subscribe('INDICATOR_UPDATED', async (e) => {
      capturedIndicator = e;
      const trace = EventFactory.createTrace(e.trace.correlationId, e.eventId, 'StrategyEngine', e.trace.sequence);
      const strat = EventFactory.createEvent('STRATEGY_SIGNAL', ROBOT, trace, {});
      await eventBus.publish(strat);
    });

    eventBus.subscribe('STRATEGY_SIGNAL', async (e) => {
      capturedStrategy = e;
    });

    const initialTrace = EventFactory.createTrace('corr-999', 'root', 'Market', 20);
    const candle = EventFactory.createEvent('CANDLE_CLOSED', ROBOT, initialTrace, {});
    await eventBus.publish(candle);
    await eventBus.waitForIdle(ROBOT);

    expect(capturedIndicator.trace.parentId).toBe(capturedCandle.eventId);
    expect(capturedStrategy.trace.parentId).toBe(capturedIndicator.eventId);
    
    expect(capturedCandle.trace.correlationId).toBe('corr-999');
    expect(capturedIndicator.trace.correlationId).toBe('corr-999');
    expect(capturedStrategy.trace.correlationId).toBe('corr-999');
    
    expect(capturedIndicator.trace.sequence).toBe(20);
    expect(capturedStrategy.trace.sequence).toBe(20);
  });
});
