import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { StateMachineEngine } from '../../engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../infrastructure/EventBus';
import { EventFactory } from '../../infrastructure/EventFactory';
import { Clock } from '../../infrastructure/Clock';
import { IdGenerator } from '../../infrastructure/IdGenerator';
import { coreIdempotencyStore } from '../../infrastructure/IdempotencyStore';

describe('Phase 3: State Machine Deterministic Hash', () => {
  let engine: StateMachineEngine;
  const hashList: string[] = [];

  const runReplay = async () => {
    coreIdempotencyStore.clear();
    coreEventBus.clearAll();

    engine = new StateMachineEngine();
    await engine.initialize();
    engine.registerRobot('RobotHash', 2);

    let eventOutput: any = null;
    const unsub = coreEventBus.subscribe('READY_TO_ENTER', async (evt: any) => {
      eventOutput = evt; // Lấy TẤT CẢ event, không bóc tách
    });

    const trace = EventFactory.createTrace('corr1', 'p1', 'eng', 1);

    await coreEventBus.publish(EventFactory.createEvent('SIGNAL_DETECTED', 'RobotHash', trace, {
      signalSide: 'LONG', currentPrice: 105
    }) as any);
    
    await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotHash', trace, {
        indicators: { BB_MB: { band4: 100, band5: 90 } } 
    }) as any);

    await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotHash', trace, {
      candle: { close: 91 }
    }) as any);
    
    await coreEventBus.waitForIdle('RobotHash');
    
    // Hash output
    const str = JSON.stringify(eventOutput);
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    hashList.push(hash);
    
    unsub();
    await engine.shutdown();
  };

  it('SM3: 100 lần replay đều sinh ra chính xác 1 Hash Output', async () => {
    for (let i = 0; i < 50; i++) {
       await runReplay();
    }

    hashList.length = 0; // Clear the list before deterministic test

    const runFullHashReplay = async () => {
      // Bật chế độ Deterministic cho Replay
      Clock.setTime(1620000000000);
      IdGenerator.setDeterministic('replay-mock');
      coreIdempotencyStore.clear();
      coreEventBus.clearAll();

      engine = new StateMachineEngine();
      await engine.initialize();
      engine.registerRobot('RobotHash', 2);
  
      let eventOutput: any = null;
      const unsub = coreEventBus.subscribe('READY_TO_ENTER', async (evt: any) => {
        eventOutput = evt; // Lấy TẤT CẢ event, không bóc tách
      });
  
      const trace = EventFactory.createTrace('corr1', 'p1', 'eng', 1);
  
      await coreEventBus.publish(EventFactory.createEvent('SIGNAL_DETECTED', 'RobotHash', trace, {
        signalSide: 'LONG', currentPrice: 105
      }) as any);
      
      await coreEventBus.publish(EventFactory.createEvent('INDICATOR_UPDATED', 'RobotHash', trace, {
          indicators: { BB_MB: { band4: 100, band5: 90 } } 
      }) as any);
  
      await coreEventBus.publish(EventFactory.createEvent('CANDLE_CLOSED', 'RobotHash', trace, {
        candle: { close: 91 }
      }) as any);
      
      await coreEventBus.waitForIdle('RobotHash');
      
      const str = JSON.stringify(eventOutput);
      hashList.push(crypto.createHash('sha256').update(str).digest('hex'));
      
      unsub();
      await engine.shutdown();
    };

    for(let i = 0; i < 100; i++) {
        await runFullHashReplay();
    }

    const firstHash = hashList[0];
    for (let i = 1; i < 100; i++) {
      expect(hashList[i]).toBe(firstHash);
    }
  });
});
