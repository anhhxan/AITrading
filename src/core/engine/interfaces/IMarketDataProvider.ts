/**
 * Interface chuẩn cho mọi sàn giao dịch (Dependency Inversion).
 * Tuân thủ Hiến pháp Core Engine - Mục 14 (Integration Contract).
 */
export interface OHLCV {
  timestamp: number; // Mở nến (Local time or Exchange time tùy Clock)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean; // TRUE nếu đây là nến chốt (đã đóng).
}

export interface IMarketDataProvider {
  /**
   * Kết nối tới Provider (Ví dụ: Mở WebSocket)
   */
  connect(): Promise<void>;

  /**
   * Đăng ký nhận dữ liệu cho một cặp giao dịch
   */
  subscribe(symbol: string, timeframe: string): void;

  /**
   * Lắng nghe sự kiện nến đóng (Core Engine chỉ xử lý khi nến đóng)
   */
  onCandleClosed(callback: (candle: OHLCV) => void): void;

  /**
   * Lắng nghe sự kiện giá thay đổi realtime (Dùng cho Stoploss/TakeProfit động)
   */
  onTick(callback: (price: number, timestamp: number) => void): void;

  /**
   * Ngắt kết nối an toàn
   */
  disconnect(): Promise<void>;
}
