import { describe, it, expect, vi } from 'vitest';
import { PluginLoader } from '../../engine/runtime/PluginLoader';
import { IIndicator, Candle } from '../../interfaces/PluginInterfaces';

// Mock một Plugin cố tình Crash
class CrashPlugin implements IIndicator {
  public name = 'CRASH_PLUGIN';
  init() {}
  update(candle: Candle): Record<string, any> {
    throw new Error("I am a bad plugin");
  }
  getSnapshot() { return {}; }
}

// Mock một Plugin tốt
class GoodPlugin implements IIndicator {
  public name = 'GOOD_PLUGIN';
  init() {}
  update(candle: Candle): Record<string, any> {
    return { ready: true, value: candle.close };
  }
  getSnapshot() { return {}; }
}

describe('Phase 2: Plugin Isolation', () => {
  it('I1: Plugin Crash bị bắt lỗi an toàn (Isolation), không làm sập tiến trình', () => {
    const badPlugin = new CrashPlugin();
    const goodPlugin = new GoodPlugin();
    const candle = { timestamp: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 };

    // Update Plugin Bad (phải trả về error thay vì văng exception làm chết Node.js)
    const badResult = PluginLoader.safeUpdate(badPlugin, candle);
    
    expect(badResult.ready).toBe(false);
    expect(badResult.error).toBe(true);
    expect(badResult.crashMessage).toBe("I am a bad plugin");

    // Update Plugin Good (vẫn chạy bình thường)
    const goodResult = PluginLoader.safeUpdate(goodPlugin, candle);
    
    expect(goodResult.ready).toBe(true);
    expect(goodResult.value).toBe(2);
  });
});
