import { describe, it, expect } from 'vitest';
import { EventFactory } from '../../infrastructure/EventFactory';
import { Clock } from '../../infrastructure/Clock';

describe('EventFactory & DecisionTrace Contract', () => {
  it('E1: Phải tự động gắn IdempotencyKey từ bối cảnh Trace', () => {
    Clock.setTime(5000);
    const trace = EventFactory.createTrace('corr-999', 'parent-1', 'StrategyEngine', 5);
    const event = EventFactory.createEvent('ORDER_CREATED_EVENT', 'ROBOT-A', 1 /* configVersion */, trace, { price: 100 });

    expect(event.eventId).toBeDefined();
    expect(event.idempotencyKey).toBe('ROBOT-A-ORDER_CREATED_EVENT-corr-999-5');
    expect(event.timestamp).toBe(5000);
    expect(event.schemaVersion).toBe('1.0.0');
    expect(event.trace.correlationId).toBe('corr-999');
  });

  it('E2: DecisionTrace sinh ra phải có UUID TraceID', () => {
    const trace = EventFactory.createTrace('c1', 'p1', 'e1', 1);
    expect(trace.traceId.length).toBeGreaterThan(10);
    expect(trace.correlationId).toBe('c1');
    expect(trace.sequence).toBe(1);
  });
});
