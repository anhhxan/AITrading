import { describe, it, expect } from 'vitest';
import { ExpectedIndicatorConfigSchema } from '../../contracts/TradingViewConfig';

describe('Data Contract V1: TradingView Config', () => {
  it('C1: Valid config passes and injects default mapping', () => {
    const config = {
      length: 20,
      source: 'close',
      mult: 2,
      mult2: 1
    };
    
    const parsed = ExpectedIndicatorConfigSchema.parse(config);
    expect(parsed.length).toBe(20);
    expect(parsed.mapping.line1).toBe('upper');
    expect(parsed.mapping.line5).toBe('lower');
  });

  it('C2: Cannot override canonical mapping with invalid values', () => {
    const maliciousConfig = {
      length: 20,
      source: 'close',
      mult: 2,
      mult2: 1,
      mapping: {
        line1: 'lower', // malicious swap
        line2: 'upper2',
        line3: 'basis',
        line4: 'lower2',
        line5: 'lower'
      }
    };
    
    const result = ExpectedIndicatorConfigSchema.safeParse(maliciousConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Invalid input: expected");
    }
  });

  it('C3: Rejects invalid length or negative mult', () => {
    const result = ExpectedIndicatorConfigSchema.safeParse({
      length: -20,
      source: 'close',
      mult: -2,
      mult2: 1
    });
    
    expect(result.success).toBe(false);
  });
});
