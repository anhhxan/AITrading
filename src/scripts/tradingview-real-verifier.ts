import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { TradingViewAdapter } from '../core/adapters/tradingview/TradingViewAdapter';
import { StrategyEngine } from '../core/engine/strategies/StrategyEngine';
import { StateMachineEngine } from '../core/engine/runtime/StateMachineEngine';
import { RiskEngine } from '../core/engine/risk/RiskEngine';
import { coreEventBus } from '../core/infrastructure/EventBus';

const app = express();
app.use(express.json());

const dumpFile = path.join(__dirname, '../../tv_real_dump.json');
// Clear old dump
if (fs.existsSync(dumpFile)) fs.unlinkSync(dumpFile);

function appendDump(record: any) {
    fs.appendFileSync(dumpFile, JSON.stringify(record) + '\n');
}

const strategyEngine = new StrategyEngine();
const stateMachineEngine = new StateMachineEngine();
const riskEngine = new RiskEngine();
const adapter = new TradingViewAdapter();

const expectedConfig = {
    canonicalSymbol: 'XAUUSD',
    timeframe: '3H', 
    indicator: {
        name: 'BB_MB',
        length: 20,
        source: 'close',
        mult: 2.5,
        mult2: 1.3
    }
};

async function bootstrap() {
    await strategyEngine.initialize();
    await stateMachineEngine.initialize();
    await riskEngine.initialize();
    
    adapter.registerConfig('RobotXAU', expectedConfig);

    strategyEngine.registerRobot('RobotXAU', 'BB_Strategy', { retracementZonePercent: 20, timeoutCandles: 3 });
    stateMachineEngine.registerRobot('RobotXAU');
    riskEngine.registerRobotConfig('RobotXAU', { tradingViewSymbol: 'XAUUSD', executionSymbol: 'XAUUSD', timeframe: '15m', accountBalance: 10000, riskPercent: 2, maxAllocationPercent: 50, leverage: 1 });

    coreEventBus.subscribe('CANDLE_CLOSED', async (e) => appendDump({ type: 'CORE_EVENT', eventType: 'CANDLE_CLOSED', processedAt: Date.now(), event: e }));
    coreEventBus.subscribe('INDICATOR_UPDATED', async (e) => appendDump({ type: 'CORE_EVENT', eventType: 'INDICATOR_UPDATED', processedAt: Date.now(), event: e }));
    coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', async (e) => appendDump({ type: 'CORE_EVENT', eventType: 'STRATEGY_SIGNAL_EVENT', processedAt: Date.now(), event: e }));
    coreEventBus.subscribe('STATE_TRANSITION_EVENT', async (e) => appendDump({ type: 'CORE_EVENT', eventType: 'STATE_TRANSITION_EVENT', processedAt: Date.now(), event: e }));
    coreEventBus.subscribe('TRADE_PLAN_EVENT', async (e) => appendDump({ type: 'CORE_EVENT', eventType: 'TRADE_PLAN_EVENT', processedAt: Date.now(), event: e }));

    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({ status: 'ok' });
    });

    app.post('/webhook/tv/:robotId', async (req: Request, res: Response): Promise<any> => {
        const receivedAt = Date.now();
        const robotId = req.params.robotId as string;
        const payload = req.body;
        
        let canonicalTimeframe = payload.timeframe;
        if (payload.timeframe === '60') canonicalTimeframe = '1H';
        if (payload.timeframe === '120') canonicalTimeframe = '2H';
        if (payload.timeframe === '180') canonicalTimeframe = '3H';
        if (payload.timeframe === '240') canonicalTimeframe = '4H';

        const validationErrors: string[] = [];
        if (payload.tvSymbol !== expectedConfig.canonicalSymbol) validationErrors.push('Symbol mismatch');
        if (canonicalTimeframe !== expectedConfig.timeframe) validationErrors.push('Timeframe mismatch');
        if (payload.indicator?.length !== expectedConfig.indicator.length) validationErrors.push('Length mismatch');
        if (payload.indicator?.source !== expectedConfig.indicator.source) validationErrors.push('Source mismatch');
        if (payload.indicator?.mult !== expectedConfig.indicator.mult) validationErrors.push('Mult mismatch');
        if (payload.indicator?.mult2 !== expectedConfig.indicator.mult2) validationErrors.push('Mult2 mismatch');

        const validationResult = validationErrors.length === 0 ? 'PASS' : 'REJECT';

        // 1. Log Raw Payload before any processing
        appendDump({
            type: 'WEBHOOK_RECEIVED',
            receivedAt: new Date(receivedAt).toISOString(),
            robotId,
            payload,
            headers: {
                'user-agent': req.headers['user-agent'] as string,
                'content-type': req.headers['content-type'] as string,
                'x-forwarded-for': req.headers['x-forwarded-for'] as string
            },
            validationResult,
            validationErrors,
            canonicalSymbol: expectedConfig.canonicalSymbol,
            canonicalTimeframe,
            barTimestamp: payload.barTimestamp,
            OHLC: {
                open: payload.open,
                high: payload.high,
                low: payload.low,
                close: payload.close
            },
            volume: payload.volume,
            indicator: payload.indicator,
            lines: {
                line1: payload.plots?.upper,
                line2: payload.plots?.upper2,
                line3: payload.plots?.basis,
                line4: payload.plots?.lower2,
                line5: payload.plots?.lower
            }
        });
        
        // 2. Console Output
        console.log(`\n[REAL TV WEBHOOK]`);
        console.log(`Robot:\n${robotId}\n`);
        console.log(`Symbol:\n${expectedConfig.canonicalSymbol}\n`);
        console.log(`Ticker:\n${payload.tvTickerId || payload.tvSymbol}\n`);
        console.log(`Timeframe:\n${payload.timeframe} -> ${canonicalTimeframe}\n`);
        console.log(`BarTimestamp:\n${payload.barTimestamp}\n`);
        console.log(`OHLC:\nO: ${payload.open}\nH: ${payload.high}\nL: ${payload.low}\nC: ${payload.close}\n`);
        console.log(`Indicator:\nLength: ${payload.indicator?.length}\nSource: ${payload.indicator?.source}\nMult: ${payload.indicator?.mult}\nMult2: ${payload.indicator?.mult2}\n`);
        console.log(`Line 1: ${payload.plots?.upper}`);
        console.log(`Line 2: ${payload.plots?.upper2}`);
        console.log(`Line 3: ${payload.plots?.basis}`);
        console.log(`Line 4: ${payload.plots?.lower2}`);
        console.log(`Line 5: ${payload.plots?.lower}\n`);
        console.log(`Validation:\n${validationResult}\n`);

        if (validationResult === 'REJECT') {
            return res.status(400).json({ status: 'REJECT', errors: validationErrors });
        }

        try {
            const success = await adapter.handleWebhook(payload, robotId);
            if (success) {
                res.status(200).json({ status: 'OK' });
            } else {
                res.status(400).json({ status: 'Adapter Validation Failed' });
            }
        } catch (e: any) {
            console.error('[VERIFIER] Error handling webhook', e);
            res.status(500).json({ status: 'Internal Error' });
        }
    });

    app.listen(3000, () => {
        console.log('[VERIFIER] Real TradingView Verifier listening on port 3000');
    });
}
bootstrap();
