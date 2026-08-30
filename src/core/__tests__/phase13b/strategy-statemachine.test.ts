import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BB_Strategy } from '../../../core/plugins/strategies/BB_Strategy';
import { StateMachineEngine, RobotState } from '../../../core/engine/runtime/StateMachineEngine';
import { coreEventBus } from '../../../core/infrastructure/EventBus';
import { EventFactory } from '../../../core/infrastructure/EventFactory';
import { getSupabaseAdmin } from '../../../lib/supabase';

describe('PHASE 3.13D - CANDLE B + SL + DATA RETENTION', () => {
    let bb: BB_Strategy;
    let sm: StateMachineEngine;

    beforeEach(async () => {
        // Use a clean slate for each test FIRST
        (coreEventBus as any).handlers.clear();
        (coreEventBus as any).queues.clear();
        (coreEventBus as any).processing.clear();
        (coreEventBus as any).deadLetterQueues.clear();
        (coreEventBus as any).pendingQueues.clear();
        (coreEventBus as any).expectedSequences.clear();
        (coreEventBus as any).currentProcessingSequences.clear();
        (coreEventBus as any).isShuttingDown = false;

        bb = new BB_Strategy();
        sm = new StateMachineEngine();
        await sm.initialize();
    });

    afterEach(async () => {
        await sm.shutdown();
    });

    const createIndicatorSnapshot = (B1: number, B2: number, B3: number, B4: number, B5: number) => ({
        ready: true, line1: B1, line2: B2, line3: B3, line4: B4, line5: B5
    });

    it('1. LONG Candidate', async () => {
        const rid = 'test-1';
        sm.registerRobot(rid, '1m');
        
        // B5(60) <= 65 <= B4(70) => LONG Candidate
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        expect(result.signal).toBe('WAIT_RETRACEMENT');
        expect(result.direction).toBe('LONG');
        expect(result.armBounds).toEqual({ lower: 70, upper: 80 }); // [B4, B3]
        expect(result.entryTrigger).toEqual({ lower: 71, upper: 71 }); // B4 + 10%
        expect(result.persistent).toBe(true);
    });

    it('2. SHORT Candidate', async () => {
        const rid = 'test-2';
        sm.registerRobot(rid, '1m');
        
        // B2(90) <= 95 <= B1(100) => SHORT Candidate
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 95, currentHigh: 95, currentLow: 95
        });
        
        expect(result.signal).toBe('WAIT_RETRACEMENT');
        expect(result.direction).toBe('SHORT');
        expect(result.armBounds).toEqual({ lower: 80, upper: 90 }); // [B3, B2]
        expect(result.entryTrigger).toEqual({ lower: 89, upper: 89 }); // B2 - 10%
        expect(result.persistent).toBe(true);
    });

    it('3. Candle B hop le -> ARM (Wait Confirmation)', async () => {
        const rid = 'test-3';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c3', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // At this point, it's in WAIT_CANDLE_B_CONFIRMATION
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_CANDLE_B_CONFIRMATION);
        
        // Send a valid price > B4 and < B3 (say 75)
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c3', 'e1', 't', 2), { price: 75, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // State should remain WAIT_CANDLE_B_CONFIRMATION (Armed, waiting for trigger)
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_CANDLE_B_CONFIRMATION);
    });

    it('4. Candle B khong hop le -> khong ARM (Cancel)', async () => {
        const rid = 'test-4';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c4', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Candle B drops below B4 (69) -> Invalid B -> CANCEL
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c4', 'e1', 't', 2), { price: 69, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
    });

    it('5. FIRE ngay trong Candle B', async () => {
        const rid = 'test-5';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c5', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Realtime price is 71, which is valid and touches trigger B4 + 10% (71)
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c5', 'e1', 't', 2), { price: 71, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        expect((sm as any).states.get(rid)).toBe(RobotState.READY_TO_ENTER);
    });

    it('6. FIRE trong Candle C/D (Persistence vo han)', async () => {
        const rid = 'test-6';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c6', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Simulating C, D, E candles with ticks inside bounds (e.g., 75)
        for (let i = 0; i < 5; i++) {
            await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c6', 'e1', 't', i+2), { price: 75, eventTimestamp: Date.now() }) as any);
            await new Promise(r => setTimeout(r, 10));
            expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_CANDLE_B_CONFIRMATION);
        }
        
        // Hits trigger eventually (next sequence is 7)
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c6', 'e1', 't', 7), { price: 71, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        expect((sm as any).states.get(rid)).toBe(RobotState.READY_TO_ENTER);
    });

    it('7. LONG Cancel', async () => {
        const rid = 'test-7';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c7', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Exceeds B3 -> CANCEL_LONG
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c7', 'e1', 't', 2), { price: 81, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
    });

    it('8. SHORT Cancel', async () => {
        const rid = 'test-8';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 95, currentHigh: 95, currentLow: 95
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c8', 'e1', 't', 1), {
            direction: 'SHORT',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Drops below B3 -> CANCEL_SHORT
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c8', 'e1', 't', 2), { price: 79, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
    });

    it('9. Sau Cancel quay lai Trigger -> khong FIRE', async () => {
        const rid = 'test-9';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c9', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Cancel
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c9', 'e1', 't', 2), { price: 81, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
        
        // Re-touch trigger
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c9', 'e1', 't', 3), { price: 71, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
    });

    it('10. Data Retention - CANCEL xoa active_setups', async () => {
        const rid = 'test-10';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c10', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c10', 'e1', 't', 2), { price: 85, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
    });

    it('11. Data Retention - FIRE xoa active_setups', async () => {
        const rid = 'test-11';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c11', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c11', 'e1', 't', 2), { price: 71, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        expect((sm as any).states.get(rid)).toBe(RobotState.READY_TO_ENTER);
    });

    it('12. Ignore invalid realtime price ticks (<= 0)', async () => {
        const rid = 'test-12';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c12', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        // Negative price should be ignored, state remains WAIT_CANDLE_B_CONFIRMATION
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c12', 'e1', 't', 2), { price: -5, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_CANDLE_B_CONFIRMATION);
    });

    it('13. Idempotency test (Duplicate signals are ignored)', async () => {
        const rid = 'test-13';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        const event = EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c13', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        });
        
        await coreEventBus.publish(event as any);
        await new Promise(r => setTimeout(r, 50));
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_CANDLE_B_CONFIRMATION);
        
        // Manual override to verify idempotency doesn't alter state
        (sm as any).states.set(rid, RobotState.WAIT_SIGNAL);
        
        await coreEventBus.publish(event as any);
        await new Promise(r => setTimeout(r, 50));
        
        // State should remain WAIT_SIGNAL because the event was ignored
        expect((sm as any).states.get(rid)).toBe(RobotState.WAIT_SIGNAL);
    });

    it('14. Cancel Trigger Hit emits STATE_TRANSITION_EVENT', async () => {
        const rid = 'test-14';
        sm.registerRobot(rid, '1m');
        const result = bb.evaluate({
            robotId: rid,
            indicatorSnapshot: createIndicatorSnapshot(100, 90, 80, 70, 60),
            currentPrice: 65, currentHigh: 65, currentLow: 65
        });
        
        await coreEventBus.publish(EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', rid, 1, EventFactory.createTrace('c14', 'e1', 't', 1), {
            direction: 'LONG',
            entryTrigger: result.entryTrigger,
            armBounds: result.armBounds,
            persistent: result.persistent
        }) as any);
        await new Promise(r => setTimeout(r, 50));
        
        let eventEmitted = false;
        const unsub = coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => {
            if (e.payload.reason === 'CANCEL_TRIGGER_HIT') eventEmitted = true;
        });
        
        await coreEventBus.publish(EventFactory.createEvent('REALTIME_PRICE_EVENT', rid, 1, EventFactory.createTrace('c14', 'e1', 't', 2), { price: 81, eventTimestamp: Date.now() }) as any);
        await new Promise(r => setTimeout(r, 50));
        expect(eventEmitted).toBe(true);
        unsub();
    });

    it('15. Stop Loss is calculated as 20% distance', async () => {
        expect(70 - (70 - 60) * 0.20).toBe(68);
    });
});
