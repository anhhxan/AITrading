"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var BB_Strategy_1 = require("./src/core/plugins/strategies/BB_Strategy");
var strat = new BB_Strategy_1.BB_Strategy();
strat.init({});
var ctx = {
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
var result = strat.evaluate(ctx);
console.log(JSON.stringify(result, null, 2));
