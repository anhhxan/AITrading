import { describe, it, expect } from 'vitest';
import { BB_MB_Indicator } from '../../plugins/indicators/BB_MB';
import * as crypto from 'crypto';

describe('Phase 2: Indicator Hash Test', () => {
  it('H1: Indicator phải Deterministic tuyệt đối (cùng input -> Hash 100% giống)', () => {
    // Tạo 1 mảng OHLCV cố định (30 nến)
    const mockCandles = Array.from({ length: 30 }).map((_, i) => ({
      timestamp: 1600000000 + i * 60000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 100 + i + (i % 2 === 0 ? 1 : -1),
      volume: 1000
    }));

    // Hàm lấy Hash cuối cùng của indicator sau khi đẩy 30 nến
    const getFinalHash = () => {
      const indicator = new BB_MB_Indicator();
      indicator.init({  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  });
      
      let finalSnapshot: any = {};
      for (const candle of mockCandles) {
        finalSnapshot = indicator.update(candle);
      }
      
      // Tạo SHA256 từ snapshot string
      const str = JSON.stringify(finalSnapshot);
      return crypto.createHash('sha256').update(str).digest('hex');
    };

    // Chạy 100 lần và đảm bảo hash giống nhau tuyệt đối
    const firstHash = getFinalHash();
    
    for (let i = 0; i < 100; i++) {
      const currentHash = getFinalHash();
      expect(currentHash).toBe(firstHash);
    }
  });
});
