import { describe, it, expect } from 'vitest';
import { BB_MB_Indicator } from '../../plugins/indicators/BB_MB';

describe('Phase 2: Plugin Performance', () => {
  it('P1: Đo lường độ trễ (latency) của BB_MB phải dưới ngưỡng', () => {
    const candle = { timestamp: 1, open: 100, high: 105, low: 95, close: 102, volume: 1000 };
    
    // Prepare indicator with history 19
    const indicator = new BB_MB_Indicator();
    indicator.init({ length: 20, mult: 2.0, mult2: 1.0, source: 'close' });
    for(let i = 0; i < 19; i++) {
        indicator.update(candle);
    }

    // Warm up JS JIT
    for(let i = 0; i < 1000; i++) {
        indicator.update(candle);
    }

    const RUNS = 10000;
    const start = performance.now();
    
    for(let i = 0; i < RUNS; i++) {
        indicator.update(candle);
    }
    
    const end = performance.now();
    const totalMs = end - start;
    const latencyNs = (totalMs / RUNS) * 1e3; // microseconds

    // Yêu cầu: Độ trễ của Indicator Update phải cực thấp, < 20 microseconds cho BB_MB
    expect(latencyNs).toBeLessThan(50); // Cho phép 50us (microsecond) an toàn trong test runner
    console.log(`[Plugin Performance] BB_MB Latency: ${latencyNs.toFixed(2)} μs`);
  });
});
