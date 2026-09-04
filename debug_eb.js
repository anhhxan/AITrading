require('dotenv').config({ path: '.env.local' });
const { RuntimeManager } = require('./src/worker/RuntimeManager.ts');
const { CommandPoller } = require('./src/worker/CommandPoller.ts');
const { getSupabaseAdmin } = require('./src/lib/supabase.ts');
const { coreEventBus } = require('./src/core/infrastructure/EventBus.ts');

async function debugEventBus() {
    const runtimeManager = new RuntimeManager();
    await runtimeManager.initializeEngines();

    console.log('EventBus handlers for INDICATOR_UPDATED:', coreEventBus.handlers.get('INDICATOR_UPDATED')?.length || 0);

    coreEventBus.subscribe('INDICATOR_UPDATED', async (e) => {
        console.log('--- TEST HANDLER RECEIVED INDICATOR_UPDATED ---', e.robotId);
    });

    const poller = new CommandPoller(runtimeManager);
    
    // Simulate a fake command
    const fakeCommand = {
        id: 'fake-id',
        robot_id: 'e0d00614-dfcc-4948-b840-340bfa0f8707',
        payload: {
            exchange: 'binance',
            ticker: 'BTCUSDT',
            time: '2026-09-04T00:00:00Z',
            bar: { open: 1, high: 2, low: 1, close: 2, volume: 100 }
        }
    };
    
    console.log('Processing command...');
    await poller['processCommand'](fakeCommand);
    console.log('Done processing command');
}
debugEventBus().catch(console.error);
