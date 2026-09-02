import { RuntimeManager } from './src/worker/RuntimeManager';
import { CommandPoller } from './src/worker/CommandPoller';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const rm = new RuntimeManager();
  await rm.initializeEngines();
  await rm.getOrCreateRuntime('e0d00614-dfcc-4948-b840-340bfa0f8707');
  
  const poller = new CommandPoller(rm);
  
  const payload = {
      "low": 76264,
      "high": 76695.4,
      "open": 76605.98,
      "close": 76680.88,
      "plots": {
        "B1": 78176.2098952207,
        "B2": 77678.7849855147,
        "B3": 77139.9079999999,
        "B4": 76601.031014485,
        "B5": 76103.606104779
      },
      "volume": 321.4,
      "tvSymbol": "BINANCE:BTCUSDT",
      "indicator": {
        "mult": 2.5,
        "mult2": 1.3,
        "length": 20,
        "source": "close"
      },
      "timeframe": "15",
      "barTimestamp": 1788345900000,
      "previousPayload": {
        "barTimestamp": 1788345000000
      }
  };
  
  const cmd = {
    command_id: 'test-123',
    robot_id: 'e0d00614-dfcc-4948-b840-340bfa0f8707',
    command_type: 'TV_SIGNAL',
    payload: payload,
    correlation_id: 'test-corr'
  };
  
  (poller as any).completeCommand = async (cid: string, status: string, res: any) => {
    console.log("COMPLETE", status);
  };
  
  await (poller as any).processCommand(cmd);
  await new Promise(r => setTimeout(r, 2000));
  console.log("Done");
  process.exit(0);
}
test();
