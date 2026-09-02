import { BB_Strategy } from './src/core/plugins/strategies/BB_Strategy';

const strat = new BB_Strategy();
strat.init({});

const ctx: any = {
  robotId: '123',
  currentPrice: 76680.88,
  currentHigh: 76695.4,
  currentLow: 76264,
  indicatorSnapshot: {
    ready: true,
    line1: 78176.2098952207,
    line2: 77678.7849855147,
    line3: 77139.9079999999,
    line4: 76601.031014485,
    line5: 76103.606104779
  }
};

const result = strat.evaluate(ctx);
console.log(JSON.stringify(result, null, 2));
