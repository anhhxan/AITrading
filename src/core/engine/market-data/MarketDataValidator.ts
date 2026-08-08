import { OHLCV } from "../interfaces/IMarketDataProvider";

/**
 * Tuân thủ Hiến pháp Core Engine - Mục 15 (Market Data Contract).
 * Trước khi nến đi vào hệ thống, nó phải qua cổng này.
 */
export class MarketDataValidator {
  
  /**
   * Kiểm tra tính toàn vẹn của một cây nến.
   * Chặn đứng mọi dữ liệu bẩn từ sàn.
   */
  public static validateCandle(candle: OHLCV): boolean {
    if (!candle) return false;

    // 0. Đảm bảo tất cả giá trị đều là số thực hợp lệ, không phải NaN hoặc Infinity
    if (!Number.isFinite(candle.open) || !Number.isFinite(candle.high) || 
        !Number.isFinite(candle.low) || !Number.isFinite(candle.close) || 
        !Number.isFinite(candle.volume) || !Number.isFinite(candle.timestamp)) {
      return false;
    }

    // 1. Rule: High >= Max(Open, Close)
    if (candle.high < Math.max(candle.open, candle.close)) {
      return false;
    }

    // 2. Rule: Low <= Min(Open, Close)
    if (candle.low > Math.min(candle.open, candle.close)) {
      return false;
    }

    // 3. Rule: Volume >= 0
    if (candle.volume < 0) {
      return false;
    }

    // 4. Rule: Nến phải được chốt mới tính là nến đóng
    if (!candle.isClosed) {
      return false;
    }

    return true;
  }

  /**
   * Kiểm tra tính liên tục của mốc thời gian giữa 2 nến liên tiếp.
   */
  public static validateContinuity(prevCandle: OHLCV | null, currentCandle: OHLCV, timeframeMs: number): boolean {
    if (!prevCandle) return true; // Nến đầu tiên

    // Nến sau phải luôn lớn hơn nến trước đúng 1 khoảng timeframe
    if (currentCandle.timestamp !== prevCandle.timestamp + timeframeMs) {
      return false;
    }

    return true;
  }
}
