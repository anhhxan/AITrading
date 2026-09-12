import { TradingPipeline } from '../src/core/engine/pipeline/TradingPipeline';
import { RuntimeManager } from '../src/worker/RuntimeManager';

async function testDirect() {
    console.log('Testing Direct Pipeline...');
    const runtimeManager = new RuntimeManager();
    await runtimeManager.initializeEngines();
    
    // Register robot config
    const robotId = 'e0d00614-dfcc-4948-b840-340bfa0f8707';
    (runtimeManager.riskEngine as any).registerRobotConfig(robotId, {
        tradingViewSymbol: 'BINANCE:BTCUSDT',
        executionSymbol: 'BTCUSDT',
        timeframe: '15',
        accountBalance: 10000,
        positionAllocationPercent: 10,
        leverage: 1
    });

    const pipeline = new TradingPipeline(runtimeManager);

    console.log('\n--- 1. ENTRY_LONG ---');
    const result1 = await pipeline.processEntrySignal(robotId, 'test_corr_1', {
        action: 'ENTRY_LONG',
        symbol: 'BINANCE:BTCUSDT',
        entry_price: 60000,
        stop_loss: 59000,
        take_profit: 61000
    });
    console.log('Result:', result1);

    console.log('\n--- 2. Duplicate ENTRY_LONG ---');
    const result2 = await pipeline.processEntrySignal(robotId, 'test_corr_2', {
        action: 'ENTRY_LONG',
        symbol: 'BINANCE:BTCUSDT',
        entry_price: 60000
    });
    console.log('Result:', result2);

    console.log('\n--- 3. EXIT_LONG ---');
    const result3 = await pipeline.processEntrySignal(robotId, 'test_corr_3', {
        action: 'EXIT_LONG',
        symbol: 'BINANCE:BTCUSDT',
        entry_price: 60500
    });
    console.log('Result:', result3);
    
    console.log('\n--- 4. EXIT_LONG (Empty) ---');
    const result4 = await pipeline.processEntrySignal(robotId, 'test_corr_4', {
        action: 'EXIT_LONG',
        symbol: 'BINANCE:BTCUSDT',
        entry_price: 60500
    });
    console.log('Result:', result4);
}

testDirect().then(() => {
    console.log('\nDone.');
    process.exit(0);
}).catch(console.error);
