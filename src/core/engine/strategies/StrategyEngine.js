"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyEngine = void 0;
var EventFactory_1 = require("../../infrastructure/EventFactory");
var EventBus_1 = require("../../infrastructure/EventBus");
var PluginLoader_1 = require("../runtime/PluginLoader");
var diagnostics_1 = require("@/lib/diagnostics");
var StrategyEngine = /** @class */ (function () {
    function StrategyEngine() {
        this.engineId = 'StrategyEngine_1';
        this.status = 'STOPPED';
        this.robotConfig = new Map();
        this.currentPrices = new Map();
        this.currentHighs = new Map();
        this.currentLows = new Map();
        this.currentTimestamps = new Map();
        this.unsubs = [];
    }
    StrategyEngine.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.status = 'STARTING';
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('CANDLE_CLOSED', function (event) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        this.currentPrices.set(event.robotId, event.candle.close);
                        this.currentHighs.set(event.robotId, event.candle.high);
                        this.currentLows.set(event.robotId, event.candle.low);
                        this.currentTimestamps.set(event.robotId, event.candle.timestamp);
                        return [2 /*return*/];
                    });
                }); }));
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('INDICATOR_UPDATED', function (event) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handleIndicatorUpdated(event)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }));
                this.status = 'READY';
                return [2 /*return*/];
            });
        });
    };
    StrategyEngine.prototype.registerRobot = function (robotId, strategyName, params) {
        var instance = PluginLoader_1.PluginLoader.loadStrategy(strategyName);
        instance.init(params);
        this.robotConfig.set(robotId, instance);
    };
    StrategyEngine.prototype.handleIndicatorUpdated = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, strategy, indicatorSnapshot, currentPrice, currentHigh, currentLow, barTimestamp, previousClose, previousSnapshot, signal, direction, diagnostics, LONG_C1, LONG_C2, LONG_C3, SHORT_C1, SHORT_C2, SHORT_C3, evalTrace, evaluatedEvent, trace, indicatorName, nextEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        robotId = event.robotId;
                        strategy = this.robotConfig.get(robotId);
                        if (!strategy)
                            return [2 /*return*/];
                        if (event.candlePairValid === false) {
                            console.log("[StrategyEngine] Skipped evaluation for ".concat(robotId, " due to INVALID candle pair (GAP)."));
                            return [2 /*return*/];
                        }
                        indicatorSnapshot = event.indicators['BB_MB'] || Object.values(event.indicators)[0];
                        currentPrice = this.currentPrices.get(robotId) || 0;
                        currentHigh = this.currentHighs.get(robotId) || 0;
                        currentLow = this.currentLows.get(robotId) || 0;
                        barTimestamp = this.currentTimestamps.get(robotId) || 'unknown';
                        previousClose = event.previousClose;
                        previousSnapshot = event.previousSnapshot || null;
                        signal = PluginLoader_1.PluginLoader.safeEvaluateStrategy(strategy, {
                            robotId: robotId,
                            indicatorSnapshot: indicatorSnapshot,
                            previousSnapshot: previousSnapshot,
                            currentPrice: currentPrice,
                            currentHigh: currentHigh,
                            currentLow: currentLow,
                            previousClose: previousClose // FIX 3: Pass down persistent previous close
                        });
                        direction = signal === 'ERROR' ? 'ERROR' : ((signal === null || signal === void 0 ? void 0 : signal.direction) || 'NONE');
                        diagnostics = {};
                        if (direction === 'NONE' || direction === 'LONG' || direction === 'SHORT') {
                            if (previousSnapshot && indicatorSnapshot && previousClose !== undefined) {
                                LONG_C1 = previousClose < previousSnapshot.line5;
                                LONG_C2 = previousClose <= previousSnapshot.line4;
                                LONG_C3 = currentPrice > indicatorSnapshot.line5;
                                SHORT_C1 = previousClose >= previousSnapshot.line2;
                                SHORT_C2 = previousClose > previousSnapshot.line1;
                                SHORT_C3 = currentPrice < indicatorSnapshot.line1;
                                diagnostics = {
                                    LONG_C1: LONG_C1,
                                    LONG_C2: LONG_C2,
                                    LONG_C3: LONG_C3,
                                    SHORT_C1: SHORT_C1,
                                    SHORT_C2: SHORT_C2,
                                    SHORT_C3: SHORT_C3,
                                    prevClose: previousClose,
                                    currClose: currentPrice,
                                    prevSnapshot: previousSnapshot,
                                    currSnapshot: indicatorSnapshot
                                };
                            }
                        }
                        console.log(JSON.stringify({
                            event: 'STRATEGY_EVALUATED',
                            correlation_id: event.trace.correlationId,
                            robot_id: robotId,
                            barTimestamp: barTimestamp,
                            result: direction,
                            diagnostics: diagnostics
                        }));
                        if (barTimestamp !== 'unknown') {
                            (0, diagnostics_1.upsertSignalTrace)({
                                robot_id: robotId,
                                bar_timestamp: Number(barTimestamp),
                                strategy_status: 'GREEN',
                                strategy_result: direction,
                                diagnostics: Object.keys(diagnostics).length > 0 ? diagnostics : undefined
                            });
                        }
                        evalTrace = EventFactory_1.EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
                        evaluatedEvent = EventFactory_1.EventFactory.createEvent('STRATEGY_EVALUATED', robotId, event.configVersion || 1, evalTrace, {
                            direction: direction,
                            result: direction,
                            commandId: event.trace.correlationId,
                            strategyId: strategy.name
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(evaluatedEvent)];
                    case 1:
                        _a.sent();
                        if (!(signal !== 'ERROR' && signal && signal.direction !== 'NONE')) return [3 /*break*/, 3];
                        trace = EventFactory_1.EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
                        indicatorName = event.indicators['BB_MB'] ? 'BB_MB' : Object.keys(event.indicators)[0];
                        nextEvent = EventFactory_1.EventFactory.createEvent('STRATEGY_SIGNAL_EVENT', robotId, event.configVersion || 1, trace, {
                            barTimestamp: event.barTimestamp,
                            direction: signal.direction,
                            maxTimeoutCandles: signal.maxTimeoutCandles || 3,
                            persistent: signal.persistent,
                            entryTrigger: signal.entryTrigger,
                            cancelTrigger: signal.cancelTrigger,
                            armBounds: signal.armBounds,
                            strategyId: strategy.name,
                            strategyVersion: 'v1.0.0',
                            indicatorReference: {
                                name: indicatorName,
                                config: indicatorSnapshot.config || {},
                                snapshot: {
                                    line1: indicatorSnapshot.line1,
                                    line2: indicatorSnapshot.line2,
                                    line3: indicatorSnapshot.line3,
                                    line4: indicatorSnapshot.line4,
                                    line5: indicatorSnapshot.line5
                                }
                            }
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(nextEvent)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    StrategyEngine.prototype.healthCheck = function () {
        return { status: this.status };
    };
    StrategyEngine.prototype.ready = function () {
        return this.status === 'READY';
    };
    StrategyEngine.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, unsub;
            return __generator(this, function (_b) {
                for (_i = 0, _a = this.unsubs; _i < _a.length; _i++) {
                    unsub = _a[_i];
                    unsub();
                }
                this.unsubs = [];
                this.status = 'STOPPED';
                return [2 /*return*/];
            });
        });
    };
    return StrategyEngine;
}());
exports.StrategyEngine = StrategyEngine;
