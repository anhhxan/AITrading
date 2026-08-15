import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BB_MB_Indicator } from '../../plugins/indicators/BB_MB';

describe('Phase 2: TradingView Compare (Golden Dataset)', () => {
  it('Test C: BB_MB calculation phải khớp TradingView với sai số tuyệt đối và tương đối (PineScript Specification)', () => {
    /**
     * PINESCRIPT SPECIFICATION FOR BB_MB:
     * - Basis: SMA (Simple Moving Average)
     * - Source: Close price
     * - Length: 20 (cần 20 nến để có kết quả)
     * - Mult1 (Outer): 2.0
     * - Mult2 (Inner): 1.0
     * - Standard Deviation: Population Standard Deviation (chia cho N, không phải N-1)
     * - Nến đầu tiên đủ dữ liệu: Nến thứ 20 (index 19)
     */
    
    // 1. Đọc file CSV
    const csvPath = path.join(__dirname, 'tradingview-golden.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.trim().split('\n').slice(1); // skip header
    
    // 2. Khởi tạo Indicator
    const indicator = new BB_MB_Indicator();
    indicator.init({  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  });

    const MAX_ABSOLUTE_ERROR = 0.0001;
    const MAX_RELATIVE_ERROR = 0.0001; // 0.01%
    
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 9) continue;
      const [Time, Open, High, Low, Close, Volume, BB_Upper, BB_Lower, BB_Basis] = parts.map(Number);
      
      const candle = {
        timestamp: Time,
        open: Open,
        high: High,
        low: Low,
        close: Close,
        volume: Volume
      };

      const result = indicator.update(candle);
      
      if (result.ready && BB_Basis > 0) { // BB_Basis > 0 ensures TradingView actually had a value
        // Absolute error
        const absErrUpper = Math.abs(result.UpperOuter - BB_Upper);
        const absErrLower = Math.abs(result.LowerOuter - BB_Lower);
        const absErrBasis = Math.abs(result.Middle - BB_Basis);

        // Relative error
        const relErrUpper = absErrUpper / Math.abs(BB_Upper);
        const relErrLower = absErrLower / Math.abs(BB_Lower);
        const relErrBasis = absErrBasis / Math.abs(BB_Basis);

        expect(absErrUpper).toBeLessThan(MAX_ABSOLUTE_ERROR);
        expect(relErrUpper).toBeLessThan(MAX_RELATIVE_ERROR);
        
        expect(absErrLower).toBeLessThan(MAX_ABSOLUTE_ERROR);
        expect(relErrLower).toBeLessThan(MAX_RELATIVE_ERROR);
        
        expect(absErrBasis).toBeLessThan(MAX_ABSOLUTE_ERROR);
        expect(relErrBasis).toBeLessThan(MAX_RELATIVE_ERROR);
      }
    }
  });
});
