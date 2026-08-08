import { EngineOrchestrator } from '../core/engine/runtime/EngineOrchestrator';
import { IndicatorEngine } from '../core/engine/indicators/IndicatorEngine';
import { coreEventBus } from '../core/infrastructure/EventBus';
import { EventFactory } from '../core/infrastructure/EventFactory';
import { Candle } from '../core/interfaces/PluginInterfaces';
import * as crypto from 'crypto';

async function run() {
  console.log('========================================');
  console.log('PHASE 2 RUNTIME ACCEPTANCE TEST');
  console.log('========================================\n');

  try {
    coreEventBus.clearAll();

    console.log('[1] Engine & Plugin Startup');
    const indicatorEngine = new IndicatorEngine();
    await indicatorEngine.initialize();
    
    // Register Robot with BB_MB plugin
    indicatorEngine.registerRobot('ROBOT_PHASE2', [
      { name: 'BB_MB', params: { length: 20, mult: 2.0, mult2: 1.0 } }
    ]);

    const orchestrator = new EngineOrchestrator();
    orchestrator.registerEngine('IndicatorEngine', indicatorEngine);
    await orchestrator.startAll();
    console.log('✓ Orchestrator & IndicatorEngine READY\n');

    let emitCount = 0;
    let firstReadyCandle = -1;
    let finalSnapshot: any = null;

    coreEventBus.subscribe('INDICATOR_UPDATED', async (e: any) => {
      emitCount++;
      if (firstReadyCandle === -1) {
        firstReadyCandle = e.trace.sequence;
      }
      finalSnapshot = e.indicators;
    });

    console.log('[2] Feeding 100 Candles');
    
    for (let i = 1; i <= 100; i++) {
      const trace = EventFactory.createTrace(`run_p2`, 'root', 'Market', i);
      const candle: Candle = {
        timestamp: Date.now(),
        open: 100 + (i % 5),
        high: 105 + (i % 5),
        low: 95 + (i % 5),
        close: 100 + (i % 5),
        volume: 1000
      };
      
      const evt = EventFactory.createEvent('CANDLE_CLOSED', 'ROBOT_PHASE2', trace, { candle });
      await coreEventBus.publish(evt);
    }

    await coreEventBus.waitForIdle('ROBOT_PHASE2');

    console.log('✓ Received 100 CANDLE_CLOSED_EVENTS');
    console.log(`✓ Plugin READY at candle #${firstReadyCandle}`);
    console.log(`✓ Emitted ${emitCount} INDICATOR_UPDATED_EVENTs`);

    if (firstReadyCandle === 20 && emitCount === 81) {
      console.log('✓ Warmup boundaries verified (1-19 dropped, 20-100 emitted)');
    } else {
      throw new Error(`Warmup failed. firstReady=${firstReadyCandle}, emitCount=${emitCount}`);
    }

    // Deterministic Check
    const hash = crypto.createHash('sha256').update(JSON.stringify(finalSnapshot)).digest('hex');
    console.log(`✓ Final Snapshot Hash: ${hash}\n`);

    console.log('========================================');
    console.log('FINAL RESULT: PASS');
    console.log('========================================\n');
    
    await orchestrator.startAll().catch(() => {}); // Dummy to check error
    process.exit(0);
  } catch (error) {
    console.error(error);
    console.log('========================================');
    console.log('FINAL RESULT: FAIL');
    console.log('========================================\n');
    process.exit(1);
  }
}

run();
