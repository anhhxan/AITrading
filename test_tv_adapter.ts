import { TradingViewAdapter } from './src/core/adapters/tradingview/TradingViewAdapter.ts';
const payload = {
    low: 77608,
    high: 77975.46,
    open: 77843.34,
    close: 77615.24,
    plots: {
      B1: 78132.7824400342,
      B2: 77809.4482288178,
      B3: 77459.1695,
      B4: 77108.8907711822,
      B5: 76785.5565599658
    },
    volume: 341.00857,
    tvSymbol: 'BINANCE:BTCUSDT',
    indicator: { mult: 2.5, mult2: 1.3, length: 20, source: 'close' },
    timeframe: '60',
    barTimestamp: 1788426000000,
    previousPayload: {
      low: 77663.14,
      high: 78066,
      open: 77663.14,
      close: 77843.34,
      plots: {
        B1: 78123.71,
        B2: 77793.47,
        B3: 77435.71,
        B4: 77077.95,
        B5: 76747.70
      },
      volume: 363.22912,
      tvSymbol: 'BINANCE:BTCUSDT',
      indicator: { mult: 2.5, mult2: 1.3, length: 20, source: 'close' },
      timeframe: '60',
      barTimestamp: 1788422400000
    }
};

async function test() {
    const adapter = new TradingViewAdapter();
    adapter.getDbConfig = async () => ({
       config: { BB_MB: { source: 'close', mult: 2.5, length: 20 } },
       version: 1
    });
    
    adapter.sequences.set('robot1', 1);
    const res = await adapter.handleWebhook(payload, 'robot1');
    console.log(JSON.stringify(res, null, 2));
}
test();
