import { BaseEvent } from "./EventFactory";

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
    const robotId = event.robotId;
    if (!this.queues.has(robotId)) {
      this.queues.set(robotId, []);
    }
    
    // Đưa vào queue của Robot tương ứng
    this.queues.get(robotId)!.push(event);
    
    // Kích hoạt worker xử lý queue của Robot này (Fire and forget)
    this.processQueue(robotId);
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
}

// Singleton instance cho toàn bộ Core Engine
export const coreEventBus = new EventBus();
