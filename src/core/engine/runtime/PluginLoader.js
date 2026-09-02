"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLoader = void 0;
var BB_MB_1 = require("../../plugins/indicators/BB_MB");
var BB_Strategy_1 = require("../../plugins/strategies/BB_Strategy");
/**
 * Plugin Loader & Isolator
 * Tôn trọng kiến trúc Make it work. Tập trung quản lý và cô lập an toàn Plugin.
 */
var PluginLoader = /** @class */ (function () {
    function PluginLoader() {
    }
    /**
     * Khởi tạo Indicator từ tên định danh.
     */
    PluginLoader.loadIndicator = function (name) {
        if (name === 'BB_MB') {
            return new BB_MB_1.BB_MB_Indicator();
        }
        throw new Error("[PluginLoader] Indicator Plugin kh\u00F4ng t\u1ED3n t\u1EA1i: ".concat(name));
    };
    PluginLoader.loadStrategy = function (name) {
        if (name === 'BB_Strategy') {
            return new BB_Strategy_1.BB_Strategy();
        }
        throw new Error("[PluginLoader] Strategy Plugin kh\u00F4ng t\u1ED3n t\u1EA1i: ".concat(name));
    };
    /**
     * Khởi tạo, cấu hình và kiểm tra hợp lệ Indicator.
     */
    PluginLoader.loadAndInitializeIndicator = function (name, params) {
        var instance = this.loadIndicator(name);
        instance.init(params);
        if (!instance.validate()) {
            throw new Error("[PluginLoader] Indicator Plugin configuration invalid: ".concat(name));
        }
        return instance;
    };
    /**
     * Warmup một Plugin với dữ liệu lịch sử
     */
    PluginLoader.warmup = function (indicator, historicalCandles) {
        try {
            indicator.warmup(historicalCandles);
        }
        catch (error) {
            console.error("[PluginLoader] FATAL: Indicator Plugin ".concat(indicator.name, " crashed during warmup!"), error);
        }
    };
    /**
     * Cô lập (Isolation): Gọi update trong một sandbox an toàn
     * Đảm bảo một plugin bị lỗi không làm sập tiến trình chung của Engine.
     */
    PluginLoader.safeUpdate = function (indicator, candle) {
        try {
            return indicator.update(candle);
        }
        catch (error) {
            console.error("[PluginLoader] FATAL: Indicator Plugin ".concat(indicator.name, " crashed during update!"), error);
            return {
                ready: false,
                error: true,
                crashMessage: error.message,
                line1: null,
                line2: null,
                line3: null,
                line4: null,
                line5: null
            };
        }
    };
    PluginLoader.safeEvaluateStrategy = function (strategy, context) {
        try {
            return strategy.evaluate(context);
        }
        catch (error) {
            console.error("[PluginLoader] FATAL: Strategy Plugin ".concat(strategy.name, " crashed during evaluate!"), error);
            return 'ERROR';
        }
    };
    return PluginLoader;
}());
exports.PluginLoader = PluginLoader;
