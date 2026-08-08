/**
 * Hiến pháp Core Engine - Mục 10: Clock Service
 * Cấm sử dụng Date.now() hoặc new Date() trong logic Engine.
 */
export class Clock {
  private static mockTime: number | null = null;

  /**
   * Lấy thời gian hiện tại của hệ thống hoặc thời gian giả lập (Replay).
   */
  public static now(): number {
    if (this.mockTime !== null) {
      return this.mockTime;
    }
    return Date.now();
  }

  /**
   * Inject thời gian giả lập (dành riêng cho Replay Engine).
   */
  public static setTime(time: number): void {
    this.mockTime = time;
  }

  /**
   * Trả về chế độ thời gian thực.
   */
  public static reset(): void {
    this.mockTime = null;
  }
}
