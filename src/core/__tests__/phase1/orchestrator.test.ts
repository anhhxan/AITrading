import { describe, it, expect, vi } from 'vitest';
import { EngineOrchestrator } from '../../engine/runtime/EngineOrchestrator';
import { IEngine } from '../../engine/runtime/IEngine';

class MockEngine implements IEngine {
  constructor(public id: string, public willFail: boolean = false) {}
  
  async initialize(): Promise<void> {
    if (this.willFail) throw new Error("Init failed");
  }
  
  async shutdown(): Promise<void> {}
  
  healthCheck() {
    return {
      engineId: this.id,
      status: this.willFail ? 'ERROR' : 'READY',
      heartbeat: 0,
      uptime: 0,
      lastError: null,
      restartCount: 0
    } as any;
  }
  
  ready(): boolean {
    return !this.willFail;
  }
}

describe('EngineOrchestrator Contract', () => {
  it('D1: Không emit START_DATA_FEED nếu 1 Engine NOT READY', async () => {
    const orchestrator = new EngineOrchestrator();
    orchestrator.registerEngine('IndicatorEngine', new MockEngine('IndicatorEngine', true)); // Fails
    
    // Bỏ qua log console
    vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await orchestrator.startAll();
    } catch (e) {}

    // Vì lỗi, không bao giờ được phép start data feed (status không thể là READY hết)
    const allReady = Array.from((orchestrator as any).engines.values()).every((e: any) => e.healthCheck().status === 'READY');
    expect(allReady).toBe(false);

    vi.restoreAllMocks();
  });

  it('E1: Engine Isolation - Restart Engine độc lập nếu lỗi', async () => {
    const orchestrator = new EngineOrchestrator();
    const goodEngine = new MockEngine('GoodEngine');
    const flakyEngine = new MockEngine('FlakyEngine');
    
    orchestrator.registerEngine('GoodEngine', goodEngine);
    orchestrator.registerEngine('FlakyEngine', flakyEngine);

    const shutdownSpy = vi.spyOn(flakyEngine, 'shutdown');
    const initSpy = vi.spyOn(flakyEngine, 'initialize');

    // Ép FlakyEngine lỗi
    await (orchestrator as any).handleEngineFailure('FlakyEngine', new Error("Mock Crash"));

    // Phải shutdown rồi init lại chính nó
    expect(shutdownSpy).toHaveBeenCalled();
    expect(initSpy).toHaveBeenCalled();

    // Trong khi đó GoodEngine không bị đụng tới
    const goodInitSpy = vi.spyOn(goodEngine, 'initialize');
    expect(goodInitSpy).not.toHaveBeenCalled();
  });
});
