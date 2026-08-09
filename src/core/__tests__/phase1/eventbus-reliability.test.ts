import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../infrastructure/EventBus';
import { BaseEvent } from '../../infrastructure/EventFactory';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

const createMockEvent = (
  robotId: string,
  eventId: string,
  idempotencyKey: string,
  sequence: number
): BaseEvent => ({
  eventId,
  eventType: 'MOCK_EVENT',
  idempotencyKey,
  eventVersion: 'v1.0.0',
  schemaVersion: '1.0.0',
  robotId,
  configVersion: 1,
  trace: {
    traceId: 'trace-1',
    correlationId: 'corr-1',
    parentId: 'root',
    engineId: 'test',
    sequence
  },
  timestamp: Date.now()
});

describe('Phase 1 Foundation Correction: EventBus Reliability', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    coreIdempotencyStore.clear();
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  it('R1: Phải chặn Event bị trùng lặp IdempotencyKey (Duplicate Processing Protection)', async () => {
    let processedCount = 0;
    bus.subscribe('MOCK_EVENT', async () => { processedCount++; });

    const event1 = createMockEvent('R1', 'ev1', 'idemp-1', 1);
    const event2 = createMockEvent('R1', 'ev2', 'idemp-1', 1); // Trùng idempotencyKey

    await bus.publish(event1);
    await bus.publish(event2); // Đáng lẽ phải bị từ chối
    
    await bus.waitForIdle('R1');
    expect(processedCount).toBe(1);
  });

  it('R2: Phải ném vào Pending Queue nếu Event bị Out-of-order Sequence', async () => {
    const processed: number[] = [];
    bus.subscribe('MOCK_EVENT', async (e) => { processed.push(e.trace.sequence); });

    // Trật tự đúng là 1, 2, 3
    const ev1 = createMockEvent('R2', 'ev1', 'idk-1', 1);
    const ev3 = createMockEvent('R2', 'ev3', 'idk-3', 3); // Gửi #3 trước #2
    const ev2 = createMockEvent('R2', 'ev2', 'idk-2', 2);

    await bus.publish(ev1);
    await bus.publish(ev3); // #3 phải pending
    
    await new Promise(r => setTimeout(r, 10)); // Đợi một chút
    // Lúc này chỉ mới có 1 được xử lý
    expect(processed).toEqual([1]);
    
    await bus.publish(ev2); // #2 tới -> gỡ chốt -> xử lý luôn #3
    await bus.waitForIdle('R2');

    expect(processed).toEqual([1, 2, 3]);
  });

  it('R3: Không được làm mất Event khi Handler văng lỗi (Phải lưu vào DLQ)', async () => {
    bus.subscribe('MOCK_EVENT', async (e) => { 
      if (e.eventId === 'ev-fail') throw new Error('Simulated Crash');
    });

    const ev = createMockEvent('R3', 'ev-fail', 'idk-fail', 1);
    await bus.publish(ev);
    await bus.waitForIdle('R3');

    const dlq = bus.getDeadLetterQueue('R3');
    expect(dlq.length).toBe(1);
    expect(dlq[0].eventId).toBe('ev-fail');
  });

  it('R4: Graceful Shutdown chặn publish event mới và đợi queue xử lý xong', async () => {
    let count = 0;
    bus.subscribe('MOCK_EVENT', async () => { 
      await new Promise(r => setTimeout(r, 10)); // Delay xử lý
      count++;
    });

    const ev1 = createMockEvent('R4', 'ev1', 'idk-1', 1);
    const ev2 = createMockEvent('R4', 'ev2', 'idk-2', 2);
    
    bus.publish(ev1);
    
    // Bắt đầu shutdown ngay lập tức
    const shutdownPromise = bus.shutdown();
    
    // Publish sau khi đã gọi shutdown -> Phải bị reject
    await expect(bus.publish(ev2)).rejects.toThrow('EventBus is shutting down');
    
    await shutdownPromise;
    expect(count).toBe(1); // Chỉ ev1 được xử lý xong
  });
  it('R5: DLQ Retry / Idempotency Interaction', async () => {
    let callCount = 0;
    bus.subscribe('MOCK_EVENT', async (e) => { 
      callCount++;
      if (callCount === 1) throw new Error('Simulated Crash 1');
    });

    const ev = createMockEvent('R5', 'ev-r5', 'idk-r5', 1);
    await bus.publish(ev);
    await bus.waitForIdle('R5');

    // It should fail on first try
    const dlq = bus.getDeadLetterQueue('R5');
    expect(dlq.length).toBe(1);
    expect(dlq[0].eventId).toBe('ev-r5');

    // Retry the exact same event
    await bus.publish(dlq[0]);
    await bus.waitForIdle('R5');

    // Second try should succeed and not be in DLQ again
    expect(callCount).toBe(2);
    expect(bus.getDeadLetterQueue('R5').length).toBe(0); 
  });

  it('R6: Shutdown drains pending events to DLQ to prevent silent loss', async () => {
    // Để có pending, expected phải là 1, ta gửi 1 rồi gửi 3 (3 sẽ pending)
    const ev1 = createMockEvent('R6', 'ev1', 'idk-1', 1);
    const ev3 = createMockEvent('R6', 'ev3', 'idk-3', 3);
    
    await bus.publish(ev1); // expected lên 2
    await bus.publish(ev3); // 3 > 2 => pending

    await bus.shutdown();
    
    // The pending event should have been moved to DLQ
    const dlq = bus.getDeadLetterQueue('R6');
    expect(dlq.length).toBe(1);
    expect(dlq[0].eventId).toBe('ev3');
  });
});
