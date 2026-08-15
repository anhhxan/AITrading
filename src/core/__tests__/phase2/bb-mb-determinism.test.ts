import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { BB_MB_Indicator } from '../../plugins/indicators/BB_MB';
import { PluginLoader } from '../../engine/runtime/PluginLoader';
import { Candle } from '../../interfaces/PluginInterfaces';

const createMockCandle = (price: number): Candle => ({
  timestamp: 1620000000000,
  open: price,
  high: price + 10,
  low: price - 10,
  close: price,
  volume: 1000
});

describe('Phase 2: BB_MB Determinism', () => {
  it('Test D: Cùng OHLCV và parameters phải sinh ra Hash giống nhau tuyệt đối', () => {
    
    const runCalculation = (): string => {
      const bb = PluginLoader.loadIndicator('BB_MB');
      bb.init({  length: 20, mult: 2.0, mult2: 1.0, source: 'close'  });
      
      let lastSnapshot = null;
      for (let i = 1; i <= 25; i++) {
        // Deterministic mock data
        const price = 100 + (i % 5) * 5; 
        lastSnapshot = PluginLoader.safeUpdate(bb, createMockCandle(price));
      }
      
      // Hash the final snapshot
      return crypto.createHash('sha256').update(JSON.stringify(lastSnapshot)).digest('hex');
    };

    const hash1 = runCalculation();
    
    for (let i = 2; i <= 100; i++) {
      const hashN = runCalculation();
      expect(hashN).toBe(hash1); // Run 100 times, must match
    }
  });
});
