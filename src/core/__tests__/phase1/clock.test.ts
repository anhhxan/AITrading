import { describe, it, expect, afterEach } from 'vitest';
import { Clock } from '../../infrastructure/Clock';

describe('Clock Service Contract', () => {
  afterEach(() => {
    Clock.reset();
  });

  it('F1: Phải trả về thời gian hệ thống khi ở chế độ Live', () => {
    const now = Clock.now();
    expect(now).toBeGreaterThan(0);
    const diff = Math.abs(now - Date.now());
    expect(diff).toBeLessThan(50); // Chênh lệch do CPU cycle không đáng kể
  });

  it('F2: Phải đóng băng thời gian chuẩn xác khi gọi setTime (Replay Engine)', () => {
    const fakeTime = 1700000000000;
    Clock.setTime(fakeTime);
    expect(Clock.now()).toBe(fakeTime);
    
    // Đảm bảo thời gian không trôi
    expect(Clock.now()).toBe(fakeTime);
  });

  it('F3: Phải reset thành công về chế độ Live', () => {
    Clock.setTime(1700000000000);
    Clock.reset();
    const now = Clock.now();
    expect(now).not.toBe(1700000000000);
    expect(Math.abs(now - Date.now())).toBeLessThan(50);
  });
});
