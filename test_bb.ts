import { BB_Strategy } from './src/core/plugins/strategies/BB_Strategy';

const bb = new BB_Strategy();
const result = bb.evaluate({
    robotId: 'test',
    indicatorSnapshot: {
        ready: true,
        line1: 100,
        line2: 90,
        line3: 80,
        line4: 70,
        line5: 60
    },
    currentPrice: 65, currentHigh: 65, currentLow: 65
});
console.log(result.cancelBounds);
