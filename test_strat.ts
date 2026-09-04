const { BB_Strategy } = require('./src/core/plugins/strategies/BB_Strategy.ts');

const strategy = new BB_Strategy();
strategy.init({});
const result = strategy.evaluate(
    { 'BB_MB': { ready: true, line1: 130, line2: 120, line3: 110, line4: 100, line5: 90 } },
    { close: 105, high: 106, low: 90, timestamp: Date.now() }
);
console.log(result);
