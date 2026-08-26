import { config } from 'dotenv';
config({ path: '.env.local' });
import { PaperExecutionEngine } from './src/core/engine/execution/PaperExecutionEngine.ts';
import { EventFactory } from './src/core/infrastructure/EventFactory.ts';
import { coreEventBus } from './src/core/infrastructure/EventBus.ts';

async function run() {
    const engine = new PaperExecutionEngine();
    await engine.initialize();
    
    console.log("Injecting TRADE_PLAN_EVENT locally...");
    const trace = EventFactory.createTrace('test-correlation-id2', 'test-event-id2', 'test-source', 100);
    const tradePlan = EventFactory.createEvent('TRADE_PLAN_EVENT', '8bf86ec5-41a4-4d11-9998-d486d23db18b', 1, trace, {
        strategyId: 'TV_SIGNAL',
        strategyVersion: 'v1',
        tradingViewSymbol: 'BINANCE:BTCUSDT',
        executionSymbol: 'BTCUSDT',
        timeframe: '15m',
        direction: 'LONG',
        triggerPrice: 78880,
        entryReferencePrice: 78880,
        stopLoss: 78000,
        takeProfit: 79000,
        accountBalance: 10000,
        positionAllocationPercent: 10,
        positionValue: 1000,
        positionSize: 0.1,
        leverage: 1,
        riskRewardRatio: 2,
        orderType: 'LIMIT',
        indicatorReference: {}
    });
    
    await coreEventBus.publish(tradePlan as any);
    console.log("Published. Waiting 5s...");
    await new Promise(r => setTimeout(r, 5000));
    
    // Check DB
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: pos } = await supabase.from('active_positions').select('*').eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b');
    console.log("Active Positions:");
    console.log(pos);
    
    const { data: ord } = await supabase.from('active_orders').select('*').eq('robot_id', '8bf86ec5-41a4-4d11-9998-d486d23db18b');
    console.log("Active Orders:");
    console.log(ord);
    
    process.exit(0);
}
run();
