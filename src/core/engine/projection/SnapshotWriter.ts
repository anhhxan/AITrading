import { DecisionTrace } from "../../infrastructure/EventFactory";

export interface OrderSnapshot {
  engineVersion: string;
  pluginVersion: string;
  pluginHash: string;
  configHash: string;
  ohlcHash: string;
  decisionTrace: DecisionTrace;
  clockTime: number;
  provider: string;
  symbol: string;
  timeframe: string;
}

/**
 * Hiến pháp Core Engine - Mục 13: Configuration Snapshot Contract
 */
export class SnapshotWriter {
  
  /**
   * Tạo Snapshot bất biến tại thời điểm Robot ra quyết định giao dịch.
   */
  public static async captureSnapshot(trace: DecisionTrace, context: any): Promise<OrderSnapshot> {
    const snapshot: OrderSnapshot = {
      engineVersion: 'v1.8.3',
      pluginVersion: context.indicator?.pluginVersion || 'v1.0.0',
      pluginHash: context.indicator?.pluginHash || 'hash...',
      configHash: 'cfghash...', // Tính toán từ bối cảnh
      ohlcHash: 'ohlchash...',
      decisionTrace: trace,
      clockTime: context.marketData?.exchangeTimestamp || Date.now(),
      provider: context.provider?.name || 'Binance',
      symbol: context.marketData?.symbol || 'BTCUSDT',
      timeframe: context.marketData?.timeframe || '3H'
    };

    console.log(`[SnapshotWriter] Captured Snapshot for Trace ${trace.correlationId}`);
    // await SnapshotRepository.save(snapshot);
    
    return snapshot;
  }
}
