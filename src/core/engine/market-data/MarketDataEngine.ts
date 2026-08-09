import { IEngine, EngineHealth } from "../runtime/IEngine";
import { IMarketDataProvider, OHLCV } from "../interfaces/IMarketDataProvider";
import { MarketDataValidator } from "./MarketDataValidator";
import { coreEventBus } from "../../infrastructure/EventBus";
import { EventFactory, DecisionTrace } from "../../infrastructure/EventFactory";
import { Clock } from "../../infrastructure/Clock";

/**
 * Hiến pháp Core Engine - Mục 1: Engine Event Contract
 * MarketDataEngine chỉ nhận Provider Feed và emit CANDLE_CLOSED_EVENT.
 */
export class MarketDataEngine implements IEngine {
  private health: EngineHealth;
  private provider: IMarketDataProvider;

  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 10;

  constructor(provider: IMarketDataProvider) {
    this.provider = provider;
    this.health = {
      engineId: 'MarketDataEngine',
      status: 'STARTING',
      heartbeat: Clock.now(),
      uptime: 0,
      lastError: null,
      restartCount: 0
    };
  }

  public async initialize(): Promise<void> {
    await this.connectWithRetry();
  }

  private async connectWithRetry(): Promise<void> {
    try {
      await this.provider.connect();
      this.health.status = 'READY';
      this.health.heartbeat = Clock.now();
      this.reconnectAttempts = 0; // Reset after success
      console.log(`[MarketDataEngine] Successfully connected to Provider.`);
    } catch (error: any) {
      this.reconnectAttempts++;
      this.health.lastError = error.message;

      if (this.reconnectAttempts > 3) {
        console.warn(`[MarketDataEngine] WARNING: Reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT} failed.`);
      }

      if (this.reconnectAttempts >= this.MAX_RECONNECT) {
        this.health.status = 'ERROR';
        throw new Error("Market Data connection failed after maximum retries.");
      }

      // Backoff (1s, 2s, 4s...)
      const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[MarketDataEngine] Retrying connection in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      await this.connectWithRetry();
    }
  }

  /**
   * Kích hoạt luồng data cho một Robot cụ thể.
   * Hành động này tạo ra một vòng đời nến khép kín (Candle Pipeline).
   */
  public subscribeRobot(robotId: string, symbol: string, timeframe: string) {
    this.provider.subscribe(symbol, timeframe);
    this.provider.onCandleClosed((candle) => this.handleCandleClosed(robotId, candle));
  }

  private async handleCandleClosed(robotId: string, candle: OHLCV) {
    this.health.heartbeat = Clock.now();

    // 1. Dùng Validator chặn data bẩn
    if (!MarketDataValidator.validateCandle(candle)) {
      console.error(`[MarketDataEngine] Invalid candle received for ${robotId}`, candle);
      // Có thể emit MARKET_DATA_ERROR_EVENT ở đây
      return;
    }

    // 2. Khởi tạo một Trace Mới hoàn toàn cho cây nến này.
    // Đây là điểm bắt đầu của mọi thứ (Correlation ID bắt nguồn từ đây).
    const trace: DecisionTrace = EventFactory.createTrace(
      `corr-${candle.timestamp}`, 
      'root', 
      'MarketDataEngine', 
      1
    );

    // 3. Đóng gói thành Event
    const event = EventFactory.createEvent(
      'CANDLE_CLOSED_EVENT',
      robotId, 
      1, // configVersion (default for test data feed)
      trace,
      { candle }
    );

    // 4. Bắn vào EventBus (Pipeline của nến bắt đầu)
    await coreEventBus.publish(event);
  }

  public healthCheck(): EngineHealth {
    return this.health;
  }

  public ready(): boolean {
    return this.health.status === 'READY';
  }

  public async shutdown(): Promise<void> {
    this.health.status = 'SHUTTING_DOWN';
    await this.provider.disconnect();
    this.health.status = 'ERROR'; // Coi như đã chết
  }
}
