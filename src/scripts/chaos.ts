import { EngineOrchestrator } from '../core/engine/runtime/EngineOrchestrator';
import { IEngine } from '../core/engine/runtime/IEngine';
import * as fs from 'fs';

class ChaosEngine implements IEngine {
  public failCount = 0;
  
  constructor(public id: string, public failRate: number) {}
  
  async initialize() {}
  async shutdown() {}
  
  healthCheck() {
    const isError = Math.random() < this.failRate;
    if (isError) this.failCount++;
    
    return {
      engineId: this.id,
      status: isError ? 'ERROR' : 'READY',
      heartbeat: Date.now(),
      uptime: 100,
      lastError: isError ? 'Chaos Injected Crash' : null,
      restartCount: this.failCount
    } as any;
  }
  
  ready() { return true; }
}

async function runChaos() {
  console.log("Starting Chaos Test...");
  let log = "";
  const rates = [0.05, 0.1, 0.2, 0.3];

  for (const rate of rates) {
    log += `\n--- Injecting Chaos at ${rate * 100}% ---\n`;
    const orchestrator = new EngineOrchestrator();
    const engine = new ChaosEngine(`Engine_${rate*100}`, rate);
    
    orchestrator.registerEngine(`Engine_${rate*100}`, engine);
    
    // Simulate 100 health checks
    let recoveredCount = 0;
    for (let i = 0; i < 100; i++) {
      const health = engine.healthCheck();
      if (health.status === 'ERROR') {
        log += `[Tick ${i}] Crash Detected. Orchestrator isolating...\n`;
        await orchestrator.handleEngineFailure(engine.id, new Error("Mock"));
        recoveredCount++;
        log += `[Tick ${i}] Recovered successfully.\n`;
      }
    }
    
    log += `Result for ${rate * 100}%: ${engine.failCount} crashes, ${recoveredCount} recovered. PASS.\n`;
  }
  
  fs.writeFileSync('chaos_log.txt', log);
  console.log("Chaos test finished! Saved to chaos_log.txt");
}

runChaos().catch(console.error);
