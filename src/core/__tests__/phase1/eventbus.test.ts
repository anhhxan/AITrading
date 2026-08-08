import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { Clock } from '../../infrastructure/Clock';
import fc from 'fast-check';

describe('EventBus Contract (CQRS & Ordering)', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    Clock.setTime(1000);
  });

  it('Test A1: FIFO Processing (Không được nhảy Sequence)', async () => {
    const processedSequences: number[] = [];

    eventBus.subscribe('TEST_EVENT', async (event) => {
      await new Promise(r => setTimeout(r, Math.random() * 5)); // Mock async IO
      processedSequences.push(event.trace.sequence);
    });

    for (let i = 1; i <= 100; i++) {
      const trace = EventFactory.createTrace('corr1', 'root', 'Engine', i);
      eventBus.publish(EventFactory.createEvent('TEST_EVENT', 'ROBOT-1', trace, { payload: i }));
    }

    await eventBus.waitForIdle('ROBOT-1');
    expect(processedSequences.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(processedSequences[i]).toBe(i + 1);
    }
  });

  it('Test A2: Multi Robot Parallel (Không block chéo)', async () => {
    const processedA: number[] = [];
    const processedB: number[] = [];

    eventBus.subscribe('TEST_EVENT', async (event) => {
      if (event.robotId === 'ROBOT-A') {
        await new Promise(r => setTimeout(r, 10)); // Robot A xử lý rất chậm
        processedA.push(event.trace.sequence);
      } else {
        await new Promise(r => setTimeout(r, 1)); // Robot B cực nhanh
        processedB.push(event.trace.sequence);
      }
    });

    for (let i = 1; i <= 50; i++) {
      eventBus.publish(EventFactory.createEvent('TEST_EVENT', 'ROBOT-A', EventFactory.createTrace('A', '', '', i), {}));
      eventBus.publish(EventFactory.createEvent('TEST_EVENT', 'ROBOT-B', EventFactory.createTrace('B', '', '', i), {}));
    }

    await eventBus.waitForIdle('ROBOT-B');
    expect(processedB.length).toBe(50);
    expect(processedA.length).toBeLessThan(50);
    
    await eventBus.waitForIdle('ROBOT-A');
    expect(processedA.length).toBe(50);
  });

  it('Test A3: Queue Blocking (Candle #100 block #101)', async () => {
    const processed: number[] = [];
    
    eventBus.subscribe('BLOCK_EVENT', async (event) => {
      if (event.trace.sequence === 100) {
        await new Promise(r => setTimeout(r, 300)); // Sleep 300ms
      }
      processed.push(event.trace.sequence);
    });

    eventBus.publish(EventFactory.createEvent('BLOCK_EVENT', 'R1', EventFactory.createTrace('C', '', '', 100), {}));
    eventBus.publish(EventFactory.createEvent('BLOCK_EVENT', 'R1', EventFactory.createTrace('C', '', '', 101), {}));
    eventBus.publish(EventFactory.createEvent('BLOCK_EVENT', 'R1', EventFactory.createTrace('C', '', '', 102), {}));

    // Sau 100ms, event 100 vẫn đang chặn toàn bộ pipeline
    await new Promise(r => setTimeout(r, 100));
    expect(processed.length).toBe(0);

    // Chờ thêm 300ms, pipeline sẽ thông, tất cả chạy qua
    await new Promise(r => setTimeout(r, 300));
    expect(processed).toEqual([100, 101, 102]);
  });

  it('Property-based Testing (Fuzzing): FIFO Invariant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 10, maxLength: 100 }), 
        async (sequences) => {
          const bus = new EventBus();
          const results: number[] = [];
          
          bus.subscribe('FUZZ', async (e) => {
            await new Promise(r => setTimeout(r, Math.random() * 2));
            results.push(e.trace.sequence);
          });

          for (const seq of sequences) {
            bus.publish(EventFactory.createEvent('FUZZ', 'FUZZ-ROBOT', EventFactory.createTrace('C', '', '', seq), {}));
          }

          await bus.waitForIdle('FUZZ-ROBOT');
          expect(results).toEqual(sequences); // Mảng kết quả phải giống hệt mảng input về thứ tự
        }
      ), { numRuns: 10 }
    );
  });
});
