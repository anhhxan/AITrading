import { StrategyEngine } from '../core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '../core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '../core/engine/risk/RiskEngine';
import { PaperPositionTracker } from '../core/engine/execution/PaperPositionTracker';
import { PaperExecutionEngine } from '../core/engine/execution/PaperExecutionEngine';
import { coreEventBus } from '../core/infrastructure/EventBus';
import { EventFactory } from '../core/infrastructure/EventFactory';

async function runE2E() {
    console.log("=== B?T Ð?U B?N TEST E2E CHI?N THU?T BB RETRACEMENT ===");
    
    // 1. Kh?i t?o các Engine d?c l?p
    const strategyEngine = new StrategyEngine();
    const stateMachine = new StateMachineEngine();
    const riskEngine = new RiskEngine();
    const positionTracker = new PaperPositionTracker();
    const executionEngine = new PaperExecutionEngine();

    await strategyEngine.initialize();
    await stateMachine.initialize();
    await riskEngine.initialize();
    await positionTracker.initialize();
    await executionEngine.initialize();

    const robotId = "TEST_ROBOT_01";

    strategyEngine.registerRobot(robotId, 'BB_Strategy', {});
    stateMachine.registerRobot(robotId, '15m');
    riskEngine.registerRobotConfig(robotId, {
        tradingViewSymbol: 'BINANCE:BTCUSDT', executionSymbol: 'BTCUSDT', timeframe: '15m',
        accountBalance: 1000, positionAllocationPercent: 10, leverage: 1
    });

    coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', async (e: any) => {
        if (e.direction !== 'NONE') {
            console.log(`[Tín Hi?u] Nh?n tín hi?u Strategy: ${e.direction} (Trigger: ${e.entryTrigger?.lower || 0} -> ${e.entryTrigger?.upper || 0})`);
        }
    });
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e: any) => console.log(`[Tr?ng Thái] Chuy?n d?i: ${e.oldState || e.previousState || 'WAIT_SIGNAL'} ? ${e.newState} (Lý do: ${e.reason})`));
    coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e: any) => console.log(`[Risk Engine] K? ho?ch giao d?ch OK! Size: ${e.positionSize}`));
    coreEventBus.subscribe('POSITION_OPENED_EVENT', async (e: any) => {
        console.log(`\n?? [Th?c Thi] VÔ L?NH THÀNH CÔNG!`);
        console.log(`   ? Hu?ng: ${e.side}`);
        console.log(`   ? Giá Vào: ${e.entryPrice}`);
        console.log(`   ? Stop Loss: ${e.stopLoss}`);
        console.log(`   ? Take Profit: ${e.takeProfit}`);
    });

    console.log("\n--- BU?C 1: TRADINGVIEW G?I WEBHOOK ---");
    
    const { SequenceAuthority } = require('../core/infrastructure/SequenceAuthority');
    

    const candleEvent = EventFactory.createEvent('CANDLE_CLOSED', robotId, 1, EventFactory.createTrace('test-corr', 'test-event', 'TradingView', SequenceAuthority.next(robotId)), {
        candle: { close: 105, high: 106, low: 90, timestamp: Date.now() }
    });
    await coreEventBus.publish(candleEvent as any);

    const tvPayload = {
        barTimestamp: Date.now(),
        indicators: {
            'BB_MB': { ready: true, line1: 130, line2: 120, line3: 110, line4: 100, line5: 90 }
        }
    };
    
    const indicatorEvent = EventFactory.createEvent('INDICATOR_UPDATED', robotId, 1, EventFactory.createTrace('test-corr', 'test-event', 'TradingView', SequenceAuthority.next(robotId)), tvPayload);
    await coreEventBus.publish(indicatorEvent as any);
    
    await new Promise(r => setTimeout(r, 500));

    console.log("\n--- BU?C 2: GIÁ REALTIME (TICK) HO?T Ð?NG ---");
    console.log("-> Ð?y giá vào Vùng Ph?c Kích (ARM Zone: B4 -> B3 t?c là t? 100 -> 110)");
    
    const sendPrice = async (price: number) => {
        console.log(`[Tick Giá] Th? tru?ng: ${price}`);
        const trace = EventFactory.createTrace('test-corr', 'test-event', 'TestRunner', SequenceAuthority.next(robotId));
        const priceEvent = EventFactory.createEvent('REALTIME_PRICE_EVENT', robotId, 1, trace, { price, eventTimestamp: Date.now() });
         
        await coreEventBus.publish(priceEvent as any);
        await new Promise(r => setTimeout(r, 200));
    };

    await sendPrice(102); 
    await sendPrice(105); 
    
    console.log("\n-> Ð?y giá ngu?c l?i Vùng Cò Súng (Trigger: B4 + 10%*(B3-B4) = 101)");
    await sendPrice(103);
    await sendPrice(101); // Kích ho?t Trigger -> READY_TO_ENTER -> TRADE_PLAN -> POSITION_OPENED
    
    await new Promise(r => setTimeout(r, 2000));
    console.log("\n=== TEST HOÀN T?T ===");
    process.exit(0);
}
runE2E().catch(console.error);

