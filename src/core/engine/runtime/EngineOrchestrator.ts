import { IEngine } from "./IEngine";
import { coreEventBus } from "../../infrastructure/EventBus";
import { EventFactory } from "../../infrastructure/EventFactory";

/**
 * Hiến pháp Core Engine - Mục 17 & 20: Orchestrator & Isolation
 * Đảm nhận Startup Sequence, Health Check và Restart khi lỗi.
 */
export class EngineOrchestrator {
  private engines: Map<string, IEngine> = new Map();
  private healthInterval: NodeJS.Timeout | null = null;

  public registerEngine(name: string, engine: IEngine) {
    this.engines.set(name, engine);
  }

  public async startAll(): Promise<void> {
    console.log("[Orchestrator] Kích hoạt Startup Sequence khắt khe...");
    
    // Khởi động tuần tự theo đúng Startup Contract
    const startupOrder = [
      'MarketDataEngine', 
      'IndicatorEngine', 
      'StrategyEngine', 
      'StateMachineEngine',
      'RiskEngine', 
      'OrderManagerEngine', 
      'ExecutionEngine', 
      'PositionManagerEngine', 
      'PnLEngine'
    ];
    
    for (const engineName of startupOrder) {
      if (this.engines.has(engineName)) {
        await this.engines.get(engineName)!.initialize();
        console.log(`[Orchestrator] ${engineName} is READY.`);
      }
    }

    // Chỉ sau khi TẤT CẢ READY, mới phát lệnh START_DATA_FEED
    const allReady = Array.from(this.engines.values()).every(e => e.ready());
    if (allReady) {
      console.log("[Orchestrator] All engines READY. Emitting START_DATA_FEED.");
      const trace = EventFactory.createTrace('sys-startup', 'root', 'Orchestrator', 0);
      const event = EventFactory.createEvent('START_DATA_FEED', 'system', trace, {});
      await coreEventBus.publish(event);
      
      this.startHealthMonitor();
    } else {
      throw new Error("Startup Failed: Some engines are not ready!");
    }
  }

  private startHealthMonitor() {
    this.healthInterval = setInterval(() => {
      this.engines.forEach((engine, name) => {
        const health = engine.healthCheck();
        if (health.status === 'ERROR') {
          this.handleEngineFailure(name, new Error(health.lastError || "Health check failed"));
        }
      });
    }, 5000);
  }

  public async handleEngineFailure(name: string, error: Error): Promise<void> {
    console.error(`[Orchestrator] Engine ${name} is in ERROR state! Initiating ISOLATED RESTART...`);
    const engine = this.engines.get(name);
    if (!engine) return;
    
    try {
      await engine.shutdown();
      await engine.initialize();
      console.log(`[Orchestrator] Engine ${name} recovered successfully.`);
    } catch (e) {
      console.error(`[Orchestrator] Engine ${name} failed to recover.`, e);
    }
  }

  public async stopAll(): Promise<void> {
    if (this.healthInterval) clearInterval(this.healthInterval);
    for (const [name, engine] of this.engines.entries()) {
      await engine.shutdown();
    }
  }
}
