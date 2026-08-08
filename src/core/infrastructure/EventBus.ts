import { BaseEvent } from "./EventFactory";
import { coreIdempotencyStore } from "./IdempotencyStore";

export type EventHandler<T extends BaseEvent> = (event: T) => Promise<void>;

/**
 * Hiến pháp Core Engine - Mục 18: EventBus Contract
 * Đảm bảo tính FIFO và Parallelism giữa các Robot.
 */
export class EventBus {
  private handlers: Map<string, Array<EventHandler<any>>> = new Map();
  // Queue event riêng cho từng Robot để đảm bảo FIFO
  private queues: Map<string, BaseEvent[]> = new Map(); 
  private processing: Map<string, boolean> = new Map();

  // Added for Reliability Correction
  private isShuttingDown: boolean = false;
  private deadLetterQueues: Map<string, BaseEvent[]> = new Map();
  private pendingQueues: Map<string, BaseEvent[]> = new Map();
  private expectedSequences: Map<string, number> = new Map();

  public subscribe<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);

    // Trả về hàm Unsubscribe
    return () => {
      const h = this.handlers.get(eventType)!;
      this.handlers.set(eventType, h.filter(x => x !== handler));
    };
  }

  public async publish<T extends BaseEvent>(event: T): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('EventBus is shutting down');
    }

    const robotId = event.robotId;
    
    // Idempotency check
    if (coreIdempotencyStore.hasSeen(event.idempotencyKey) || coreIdempotencyStore.hasSeen(event.eventId)) {
      return; // Duplicate, silently ignore or log
    }
    coreIdempotencyStore.markProcessed(event.idempotencyKey);
    coreIdempotencyStore.markProcessed(event.eventId);

    if (!this.queues.has(robotId)) this.queues.set(robotId, []);
    if (!this.deadLetterQueues.has(robotId)) this.deadLetterQueues.set(robotId, []);
    if (!this.pendingQueues.has(robotId)) this.pendingQueues.set(robotId, []);
    if (!this.expectedSequences.has(robotId)) this.expectedSequences.set(robotId, event.trace.sequence);

    const seq = event.trace.sequence;
    const expected = this.expectedSequences.get(robotId)!;

    if (seq > expected) {
      // Out of order, hold in pending
      this.pendingQueues.get(robotId)!.push(event);
      return;
    } else if (seq < expected) {
      const dlq = this.deadLetterQueues.get(robotId) || [];
      const isRetry = dlq.some(e => e.eventId === event.eventId);
      if (isRetry) {
        // Remove from DLQ and process
        this.deadLetterQueues.set(robotId, dlq.filter(e => e.eventId !== event.eventId));
        this.queues.get(robotId)!.push(event);
        this.processQueue(robotId);
        return;
      }
      // Stale event, ignore
      return;
    }

    // seq === expected
    this.queues.get(robotId)!.push(event);
    this.expectedSequences.set(robotId, expected + 1);

    // Check if any pending events can now be queued
    this.flushPending(robotId);
    
    // Kích hoạt worker xử lý queue của Robot này (Fire and forget)
    this.processQueue(robotId);
  }

  private flushPending(robotId: string) {
    const pending = this.pendingQueues.get(robotId)!;
    let expected = this.expectedSequences.get(robotId)!;
    
    let found = true;
    while (found) {
      found = false;
      const idx = pending.findIndex(e => e.trace.sequence === expected);
      if (idx !== -1) {
        const ev = pending.splice(idx, 1)[0];
        this.queues.get(robotId)!.push(ev);
        expected++;
        this.expectedSequences.set(robotId, expected);
        found = true;
      }
    }
  }

  private async processQueue(robotId: string) {
    // Nếu queue đang được xử lý, bỏ qua để tránh race condition
    if (this.processing.get(robotId)) return;
    this.processing.set(robotId, true);

    const queue = this.queues.get(robotId)!;
    
    while (queue.length > 0) {
      // FIFO: Lấy Event cũ nhất ra xử lý
      const event = queue.shift()!; 
      const handlers = this.handlers.get(event.eventType) || [];
      
      // Xử lý tuần tự các handler của cùng 1 event
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`[EventBus] Error processing event ${event.eventType} for robot ${robotId}`, error);
          this.deadLetterQueues.get(robotId)!.push(event);
          coreIdempotencyStore.remove(event.idempotencyKey);
          coreIdempotencyStore.remove(event.eventId);
        }
      }
    }

    this.processing.set(robotId, false);
  }

  /**
   * Chờ toàn bộ Event của một Robot được xử lý xong.
   * Rất quan trọng cho Automation Test và Shutdown Gracefully.
   */
  public async waitForIdle(robotId: string): Promise<void> {
    while (this.processing.get(robotId) || (this.queues.get(robotId) && this.queues.get(robotId)!.length > 0)) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  public getDeadLetterQueue(robotId: string): BaseEvent[] {
    return this.deadLetterQueues.get(robotId) || [];
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    const promises: Promise<void>[] = [];
    for (const robotId of this.queues.keys()) {
      promises.push(this.waitForIdle(robotId));
    }
    await Promise.all(promises);

    // Drain pending queues to DLQ to prevent silent loss
    for (const [robotId, pending] of this.pendingQueues.entries()) {
      if (pending.length > 0) {
        console.warn(`[EventBus] Shutdown: Robot ${robotId} has ${pending.length} pending out-of-order events. Moving to DLQ.`);
        if (!this.deadLetterQueues.has(robotId)) this.deadLetterQueues.set(robotId, []);
        this.deadLetterQueues.get(robotId)!.push(...pending);
        this.pendingQueues.set(robotId, []);
      }
    }
  }

  public clearAll(): void {
    this.handlers.clear();
    this.queues.clear();
    this.processing.clear();
    this.deadLetterQueues.clear();
    this.pendingQueues.clear();
    this.expectedSequences.clear();
    this.isShuttingDown = false;
  }
}

// Singleton instance cho toàn bộ Core Engine
export const coreEventBus = new EventBus();
