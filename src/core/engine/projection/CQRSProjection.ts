import { BaseEvent } from "../../infrastructure/EventFactory";

/**
 * Hiến pháp Core Engine - Mục 11: CQRS Pattern
 * Đây là nơi DUY NHẤT được phép UPDATE Database.
 */
export class CQRSProjection {
  
  /**
   * Lắng nghe một Event và chiếu (project) nó xuống Database.
   * Cần có một Repository layer đứng sau class này.
   */
  public async projectEvent(event: BaseEvent): Promise<void> {
    console.log(`[CQRS Projection] Persisting event ${event.eventType} for Robot ${event.robotId}`);
    
    // Switch case cho từng loại Event để update bảng tương ứng.
    switch (event.eventType) {
      case 'POSITION_OPENED_EVENT':
        // await PositionRepository.create(...)
        break;
      case 'ORDER_FILLED_EVENT':
        // await OrderRepository.update(...)
        break;
      default:
        // Lưu vào Event Log (Event Sourcing)
        // await EventRepository.append(event)
        break;
    }
  }
}
