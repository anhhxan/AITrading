/**
 * Hiến pháp Core Engine - Mục 17: Engine Startup Contract & Health Contract
 * Mọi Engine đều phải tuân thủ chuẩn này để Orchestrator có thể điều phối.
 */

export interface EngineHealth {
  engineId: string;
  status: 'STARTING' | 'READY' | 'ERROR' | 'SHUTTING_DOWN';
  heartbeat: number;
  uptime: number;
  lastError: string | null;
  restartCount: number;
}

export interface IEngine {
  /**
   * Khởi tạo Engine (Setup kết nối DB, API, load memory, cache...)
   */
  initialize(): Promise<void>;

  /**
   * Orchestrator sẽ gọi hàm này liên tục để check heartbeat.
   */
  healthCheck(): EngineHealth;

  /**
   * Trả về TRUE nếu Engine đã sẵn sàng nhận Event.
   */
  ready(): boolean;

  /**
   * Dọn dẹp tài nguyên (Graceful Shutdown)
   */
  shutdown(): Promise<void>;
}
