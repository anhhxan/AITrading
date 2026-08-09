import express, { Request, Response } from 'express';
import { TradingViewAdapter, TradingViewPayload, ExpectedConfig } from '../core/adapters/tradingview/TradingViewAdapter';
import { EngineOrchestrator } from '../core/engine/runtime/EngineOrchestrator';
import { StrategyEngine } from '../core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '../core/engine/runtime/StateMachineEngine';
import { RiskEngine, RiskConfig } from '../core/engine/risk/RiskEngine';
import { PluginLoader } from '../core/engine/runtime/PluginLoader';

const app = express();
app.use(express.json());

export const adapter = new TradingViewAdapter();
export const orchestrator = new EngineOrchestrator();

app.post('/webhook/tv/:robotId', async (req: Request, res: Response): Promise<any> => {
  const robotId = req.params.robotId as string;
  const payload = req.body as TradingViewPayload;

  console.log(`\n[WEBHOOK] Received payload for ${robotId}`);
  
  const success = await adapter.handleWebhook(payload, robotId);
  
  if (success) {
    res.status(200).send('OK');
  } else {
    res.status(400).send('VALIDATION_REJECTED');
  }
});

export async function setupPOCEngines() {
  // Register plugins for Strategy
  const strategyEngine = new StrategyEngine();
  // registerRobot(robotId: string, strategyName: string, params: any)
  strategyEngine.registerRobot('RobotXAU', 'BB_Strategy', {});
  
  const stateMachine = new StateMachineEngine();
  
  const riskEngine = new RiskEngine();
  const riskConfig: RiskConfig = {
    symbol: 'XAUUSD',
    accountBalance: 10000,
    riskPercent: 0.01, // 1%
    maxAllocationPercent: 0.20,
    leverage: 1
  };
  riskEngine.registerRobotConfig('RobotXAU', riskConfig);

  orchestrator.registerEngine('StrategyEngine', strategyEngine);
  orchestrator.registerEngine('StateMachineEngine', stateMachine);
  orchestrator.registerEngine('RiskEngine', riskEngine);

  await orchestrator.startAll();

  // Register expected config in TV Adapter
  const expectedConfig: ExpectedConfig = {
    canonicalSymbol: 'XAUUSD',
    timeframe: '3H',
    indicator: {
      length: 20,
      source: 'close',
      mult: 2.5,
      mult2: 1.3
    }
  };
  adapter.registerConfig('RobotXAU', expectedConfig);
}

export function startServer(port: number = 3000) {
  return app.listen(port, () => {
    console.log(`[WEBHOOK] Server is listening on port ${port}`);
  });
}

// Chạy trực tiếp nếu file này được call
if (require.main === module) {
  setupPOCEngines().then(() => {
    startServer();
  });
}
