/**
 * Hiến pháp Core Engine - Mục 11 & Golden Rule 9: Idempotency
 * Lưu trữ trạng thái để chặn xử lý trùng lặp.
 */
export class IdempotencyStore {
  // Trong môi trường Production, bộ nhớ này nên dùng Redis.
  // Ở giai đoạn Paper Trading, lưu In-Memory là đủ.
  private processedKeys: Set<string> = new Set();

  public hasSeen(key: string): boolean {
    return this.processedKeys.has(key);
  }

  public markProcessed(key: string): void {
    this.processedKeys.add(key);
  }
  
  public clear(): void {
    this.processedKeys.clear();
  }
}

export const coreIdempotencyStore = new IdempotencyStore();
