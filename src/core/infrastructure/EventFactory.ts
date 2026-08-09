import { Clock } from "./Clock";
import { IdGenerator } from "./IdGenerator";

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
  configVersion: number;
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
      traceId: IdGenerator.generate(),
      correlationId,
      parentId,
      engineId,
      sequence
    };
  }

  public static createEvent<T extends Record<string, any>>(
    eventType: string,
    robotId: string,
    configVersion: number,
    trace: DecisionTrace,
    payload: T
  ): BaseEvent & T {
    const eventId = IdGenerator.generate();
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
      configVersion,
      trace,
      timestamp
    } as BaseEvent & T;
  }
}
