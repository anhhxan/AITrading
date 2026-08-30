import { describe, it, expect } from 'vitest';
import { BB_Strategy } from '../../../plugins/strategies/BB_Strategy';

describe('PHASE 3.13F - STRICT B1-B5 NORMALIZATION', () => {
    it('1. B1-B5 mapping is validated correctly in Strategy', () => {
        const bb = new BB_Strategy();
        bb.init({});
        
        // B1 > B2 > B3 > B4 > B5
        const snapshot = { ready: true, line1: 100, line2: 90, line3: 80, line4: 70, line5: 60 };
        
        // 2. LONG Candidate (B5 <= Close <= B4)
        const longRes = bb.evaluate({ indicatorSnapshot: snapshot, currentPrice: 65 } as any);
        expect(longRes.direction).toBe('LONG');
        expect(longRes.armBounds).toEqual({ lower: 70, upper: 80 }); // B4, B3
        expect(longRes.entryTrigger).toEqual({ lower: 0, upper: 71 }); // B4 + (80-70)*10%
        expect(longRes.persistent).toBe(true);

        // 3. SHORT Candidate (B2 <= Close <= B1)
        const shortRes = bb.evaluate({ indicatorSnapshot: snapshot, currentPrice: 95 } as any);
        expect(shortRes.direction).toBe('SHORT');
        expect(shortRes.armBounds).toEqual({ lower: 80, upper: 90 }); // B3, B2
        expect(shortRes.entryTrigger).toEqual({ lower: 89, upper: 999999999 }); // B2 - (90-80)*10%
    });
});
