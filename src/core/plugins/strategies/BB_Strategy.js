"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BB_Strategy = void 0;
var BB_Strategy = /** @class */ (function () {
    function BB_Strategy() {
        this.name = 'BB_Strategy';
    }
    BB_Strategy.prototype.init = function (params) {
    };
    BB_Strategy.prototype.evaluate = function (context) {
        var indicatorSnapshot = context.indicatorSnapshot, currentPrice = context.currentPrice;
        if (!indicatorSnapshot || !indicatorSnapshot.ready) {
            return { direction: 'NONE' };
        }
        var currClose = currentPrice;
        var currHigh = context.currentHigh;
        var currLow = context.currentLow;
        // B1 = upper2, B2 = upper, B3 = basis, B4 = lower, B5 = lower2
        var B1 = indicatorSnapshot.line1;
        var B2 = indicatorSnapshot.line2;
        var B3 = indicatorSnapshot.line3;
        var B4 = indicatorSnapshot.line4;
        var B5 = indicatorSnapshot.line5;
        // Quy tac 1: Dong cua trong vung ngoai. Quy tac 2: Rut chan (Wick) vao vung ngoai nhung dong cua o vung trong
        var isLongRule1 = (currClose >= B5 && currClose <= B4);
        var isLongRule2 = (currLow <= B4 && currClose > B4 && currClose <= B3);
        var isLongCandidate = isLongRule1 || isLongRule2;
        var isShortRule1 = (currClose >= B2 && currClose <= B1);
        var isShortRule2 = (currHigh >= B2 && currClose < B2 && currClose >= B3);
        var isShortCandidate = isShortRule1 || isShortRule2;
        var signal = 'NONE';
        var armBounds = undefined;
        var entryTrigger = undefined;
        var cancelBounds = undefined;
        // LONG CANDIDATE
        if (isLongCandidate) {
            signal = 'LONG';
            var triggerValue = B4 + (B3 - B4) * 0.10;
            armBounds = {
                lower: B4,
                upper: B3
            };
            entryTrigger = {
                type: 'RETRACEMENT_ZONE',
                lower: 0,
                upper: triggerValue
            };
            cancelBounds = {
                lower: B5,
                upper: 999999999
            };
        }
        // SHORT CANDIDATE
        else if (isShortCandidate) {
            signal = 'SHORT';
            var triggerValue = B2 - (B2 - B3) * 0.10;
            armBounds = {
                lower: B3,
                upper: B2
            };
            entryTrigger = {
                type: 'RETRACEMENT_ZONE',
                lower: triggerValue,
                upper: 999999999
            };
            cancelBounds = {
                lower: 0,
                upper: B1
            };
        }
        if (signal === 'NONE') {
            return { direction: 'NONE' };
        }
        return {
            direction: signal,
            persistent: true,
            armBounds: armBounds,
            cancelBounds: cancelBounds,
            entryTrigger: entryTrigger
        };
    };
    return BB_Strategy;
}());
exports.BB_Strategy = BB_Strategy;
