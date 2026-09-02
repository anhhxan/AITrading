"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BB_MB_Indicator = void 0;
var BB_MB_Indicator = /** @class */ (function () {
    function BB_MB_Indicator() {
        this.name = 'BB_MB';
        this.length = 0;
        this.source = '';
        this.mult1 = 0;
        this.mult2 = 0;
        this.valueHistory = [];
    }
    BB_MB_Indicator.prototype.init = function (params) {
        if (params.length === undefined || params.mult === undefined || params.mult2 === undefined || params.source === undefined) {
            throw new Error("[BB_MB] ROBOT NOT READY: Missing required configuration (length, mult, mult2, source). Received: ".concat(JSON.stringify(params)));
        }
        this.length = params.length;
        this.source = params.source;
        this.mult1 = params.mult;
        this.mult2 = params.mult2;
    };
    BB_MB_Indicator.prototype.validate = function () {
        if (this.length <= 0)
            return false;
        if (this.mult1 <= 0 || this.mult2 <= 0)
            return false;
        if (!this.source)
            return false;
        return true;
    };
    BB_MB_Indicator.prototype.warmup = function (candles) {
        for (var _i = 0, candles_1 = candles; _i < candles_1.length; _i++) {
            var candle = candles_1[_i];
            this.update(candle);
        }
    };
    BB_MB_Indicator.prototype.update = function (candle) {
        var val = candle[this.source] !== undefined ? candle[this.source] : candle.close;
        this.valueHistory.push(val);
        // Maintain window size
        if (this.valueHistory.length > this.length) {
            this.valueHistory.shift();
        }
        return this.getSnapshot();
    };
    BB_MB_Indicator.prototype.getSnapshot = function () {
        var config = {
            length: this.length,
            source: this.source,
            mult: this.mult1,
            mult2: this.mult2
        };
        if (this.valueHistory.length < this.length) {
            return {
                ready: false,
                config: config,
                line1: null,
                line2: null,
                line3: null,
                line4: null,
                line5: null
            };
        }
        // PineScript: basis = sma(src, length)
        var sum = this.valueHistory.reduce(function (a, b) { return a + b; }, 0);
        var basis = sum / this.length;
        // PineScript: dev = mult * stdev(src, length)
        // TradingView stdev divides by N (population stdev)
        var squaredDiffs = this.valueHistory.map(function (price) { return Math.pow(price - basis, 2); });
        var variance = squaredDiffs.reduce(function (a, b) { return a + b; }, 0) / this.length;
        var stdev = Math.sqrt(variance);
        var UpperOuter = basis + this.mult1 * stdev;
        var UpperInner = basis + this.mult2 * stdev;
        var Middle = basis;
        var LowerInner = basis - this.mult2 * stdev;
        var LowerOuter = basis - this.mult1 * stdev;
        // Bandwidth = (Upper - Lower) / Basis * 100
        var Bandwidth = ((UpperOuter - LowerOuter) / basis) * 100;
        // %B = (Current - Lower) / (Upper - Lower)
        var lastValue = this.valueHistory[this.valueHistory.length - 1];
        var PercentB = UpperOuter === LowerOuter ? 0 : (lastValue - LowerOuter) / (UpperOuter - LowerOuter);
        return {
            ready: true,
            config: config,
            line1: UpperOuter,
            line2: UpperInner,
            line3: Middle,
            line4: LowerInner,
            line5: LowerOuter,
            UpperOuter: UpperOuter,
            UpperInner: UpperInner,
            Middle: Middle,
            LowerInner: LowerInner,
            LowerOuter: LowerOuter,
            Bandwidth: Bandwidth,
            PercentB: PercentB,
            stdev: stdev
        };
    };
    BB_MB_Indicator.prototype.shutdown = function () {
        this.valueHistory = [];
    };
    return BB_MB_Indicator;
}());
exports.BB_MB_Indicator = BB_MB_Indicator;
