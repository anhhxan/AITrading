import { config } from 'dotenv';
config({ path: '.env.local' });
import { RuntimeManager } from './src/worker/RuntimeManager';
import { TradingViewSignalAdapter } from './src/core/adapters/tradingview/TradingViewSignalAdapter';
import { SignalWebhookPayload } from './src/core/adapters/tradingview/TradingViewSignalAdapter';

async function run() {
    const rm = new RuntimeManager();
    await rm.initialize();
    await rm.getOrCreateRuntime('8bf86ec5-41a4-4d11-9998-d486d23db18b');
    
    console.log("Runtime initialized. Injecting TV Signal locally...");
    const adapter = new TradingViewSignalAdapter();
    
    const payload: SignalWebhookPayload = {
        direction: "LONG",
        symbol: "BINANCE:BTCUSDT",
        timeframe: "15",
        barTimestamp: Date.now(),
        bands: {
            B1: 79240,
            B2: 79120,
            B3: 79000,
            B4: 78895, // Setting B4 exactly at price
            B5: 78760
        }
    };
    
    await adapter.handleWebhook(payload, '8bf86ec5-41a4-4d11-9998-d486d23db18b', 'test-local-trace-3');
    console.log("Signal injected to local adapter. Waiting 10 seconds for trace to complete...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("Done.");
    process.exit(0);
}
run();
