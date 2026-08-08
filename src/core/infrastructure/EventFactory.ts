import { v4 as uuidv4 } from "uuid";
import { Clock } from "./Clock";

/**
 * Hiến pháp Core Engine - Mục 2: Traceability
 */
export interface DecisionTrace {
  traceId: string;
  correlationId: string;
  parentId: string;
  engineId: string;
  sequence: number;
}

/**
 * Hiến pháp Core Engine - Mục 3: Event Schema Contract
 */
export interface BaseEvent {
  eventId: string;
  eventType: string;
  idempotencyKey: string;
  eventVersion: string;
  schemaVersion: string;
  robotId: string;
  trace: DecisionTrace;
  timestamp: number;
}

export class EventFactory {
  
  public static createTrace(
    correlationId: string, 
    parentId: string, 
    engineId: string, 
    sequence: number
  ): DecisionTrace {
    return {
      traceId: uuidv4(),
      correlationId,
      parentId,
      engineId,
      sequence
    };
  }

  public static createEvent<T extends Record<string, any>>(
    eventType: string,
    robotId: string,
    trace: DecisionTrace,
    payload: T
  ): BaseEvent & T {
    const eventId = uuidv4();
    const timestamp = Clock.now();
    
    // Golden Rule 9: Idempotency Key tự sinh từ bối cảnh
    const idempotencyKey = `${robotId}-${eventType}-${trace.correlationId}-${trace.sequence}`;

    return {
      ...payload,
      eventId,
      eventType,
      idempotencyKey,
      eventVersion: 'v1.0.0', // Tương lai có thể upgrade theo Semantic Versioning
      schemaVersion: '1.0.0',
      robotId,
      trace,
      timestamp
    } as BaseEvent & T;
  }
}
