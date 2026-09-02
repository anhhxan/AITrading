"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Clock = void 0;
/**
 * Hiến pháp Core Engine - Mục 10: Clock Service
 * Cấm sử dụng Date.now() hoặc new Date() trong logic Engine.
 */
var Clock = /** @class */ (function () {
    function Clock() {
    }
    /**
     * Lấy thời gian hiện tại của hệ thống hoặc thời gian giả lập (Replay).
     */
    Clock.now = function () {
        if (this.mockTime !== null) {
            return this.mockTime;
        }
        return Date.now();
    };
    /**
     * Inject thời gian giả lập (dành riêng cho Replay Engine).
     */
    Clock.setTime = function (time) {
        this.mockTime = time;
    };
    /**
     * Trả về chế độ thời gian thực.
     */
    Clock.reset = function () {
        this.mockTime = null;
    };
    Clock.mockTime = null;
    return Clock;
}());
exports.Clock = Clock;
