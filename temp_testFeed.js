require('ts-node/register');
const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

tsConfigPaths.register({
  baseUrl: './',
  paths: tsConfig.compilerOptions.paths
});

const { RealtimePriceFeed } = require('./src/core/engine/runtime/RealtimePriceFeed');

// Mock coreEventBus globally if needed, though we can just intercept
const { coreEventBus } = require('./src/core/infrastructure/EventBus');
coreEventBus.publish = async (ev) => {
   if (ev.eventType !== 'PRICE_HEARTBEAT_EVENT' && ev.eventType !== 'REALTIME_PRICE_EVENT') {
       console.log(`[EventBus] ${ev.eventType}`, ev.payload);
   }
};

async function runTest() {
  console.log("--- TEST 1: WORKER START ---");
  const feed = new RealtimePriceFeed('test-robot', 'BINANCE:BTCUSDT');
  feed.start();
  
  await new Promise(r => setTimeout(r, 5000));
  console.log(`Status after 5s: ${feed.status}`);
  
  console.log("\n--- TEST 2 & 3: WATCHDOG STALE -> RECONNECT ---");
  // Simulate watchdog trip by advancing lastMarketTimestamp backwards
  if (feed.status === 'CONNECTED') {
      feed.lastMarketTimestamp = Date.now() - 20000; // 20s ago
      console.log("Simulated frozen price feed.");
  }
  
  await new Promise(r => setTimeout(r, 5000));
  console.log(`Status after watchdog trip: ${feed.status}`);
  
  await new Promise(r => setTimeout(r, 10000));
  
  feed.stop();
  console.log("Test finished.");
  process.exit(0);
}

runTest();
