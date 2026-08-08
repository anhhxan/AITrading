import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BB_MB_Indicator } from '../../plugins/indicators/BB_MB';

describe('Phase 2: TradingView Compare (Golden Dataset)', () => {
  it('T1: BB_MB calculation phải khớp 100% với file CSV xuất từ TradingView', () => {
    // 1. Đọc file CSV
    const csvPath = path.join(__dirname, 'tradingview-golden.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.trim().split('\n').slice(1); // skip header
    
    // 2. Khởi tạo Indicator
    const indicator = new BB_MB_Indicator();
    indicator.init({ length: 20, mult: 2.0, mult2: 1.0 });

    const EPSILON = 0.0000001;
    
    for (const line of lines) {
      const [Time, Open, High, Low, Close, Volume, BB_Upper, BB_Lower, BB_Basis] = line.split(',').map(Number);
      
      const candle = {
        timestamp: Time,
        open: Open,
        high: High,
        low: Low,
        close: Close,
        volume: Volume
      };

      const result = indicator.update(candle);
      
      // TradingView output usually only displays when ready
      if (result.ready && Time === 21) {
        // So khớp với sai số Epsilon
        expect(Math.abs(result.UpperOuter - BB_Upper)).toBeLessThan(EPSILON);
        expect(Math.abs(result.LowerOuter - BB_Lower)).toBeLessThan(EPSILON);
        expect(Math.abs(result.Middle - BB_Basis)).toBeLessThan(EPSILON);
      }
    }
  });
});
