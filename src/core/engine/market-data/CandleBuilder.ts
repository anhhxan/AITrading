import { OHLCV } from "../interfaces/IMarketDataProvider";

/**
 * Công cụ gộp nến từ dữ liệu Ticks (nếu Provider không cấp nến chuẩn).
 */
export class CandleBuilder {
  
  public static buildFromTicks(
    ticks: { price: number; volume: number; timestamp: number }[], 
    timeframeMs: number
  ): OHLCV | null {
    if (ticks.length === 0) return null;

    const open = ticks[0].price;
    const close = ticks[ticks.length - 1].price;
    let high = ticks[0].price;
    let low = ticks[0].price;
    let volume = 0;

    for (const t of ticks) {
      if (t.price > high) high = t.price;
      if (t.price < low) low = t.price;
      volume += t.volume;
    }

    // Làm tròn timestamp về đầu nến
    const startOfCandle = ticks[0].timestamp - (ticks[0].timestamp % timeframeMs);

    return {
      timestamp: startOfCandle,
      open,
      high,
      low,
      close,
      volume,
      isClosed: true
    };
  }
}
