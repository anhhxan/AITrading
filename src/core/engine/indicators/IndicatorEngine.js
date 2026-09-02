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
exports.IndicatorEngine = void 0;
var EventFactory_1 = require("../../infrastructure/EventFactory");
var EventBus_1 = require("../../infrastructure/EventBus");
var PluginLoader_1 = require("../runtime/PluginLoader");
var IndicatorEngine = /** @class */ (function () {
    function IndicatorEngine() {
        this.engineId = 'IndicatorEngine_1';
        this.status = 'STOPPED';
        // robotId -> array of active indicator instances
        this.robotConfig = new Map();
        this.unsubscribe = null;
    }
    IndicatorEngine.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (this.status === 'READY' || this.status === 'STARTING')
                    return [2 /*return*/];
                this.status = 'STARTING';
                this.unsubscribe = EventBus_1.coreEventBus.subscribe('CANDLE_CLOSED', function (event) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handleCandleClosed(event)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                this.status = 'READY';
                return [2 /*return*/];
            });
        });
    };
    IndicatorEngine.prototype.registerRobot = function (robotId, indicators) {
        var instances = indicators.map(function (ind) {
            return PluginLoader_1.PluginLoader.loadAndInitializeIndicator(ind.name, ind.params);
        });
        this.robotConfig.set(robotId, instances);
    };
    IndicatorEngine.prototype.warmupRobot = function (robotId, historicalCandles) {
        var indicators = this.robotConfig.get(robotId);
        if (!indicators)
            return;
        for (var _i = 0, indicators_1 = indicators; _i < indicators_1.length; _i++) {
            var ind = indicators_1[_i];
            PluginLoader_1.PluginLoader.warmup(ind, historicalCandles);
        }
    };
    IndicatorEngine.prototype.handleCandleClosed = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, indicators, snapshotResult, allReady, _i, indicators_2, ind, result, trace, nextEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        robotId = event.robotId;
                        indicators = this.robotConfig.get(robotId);
                        if (!indicators)
                            return [2 /*return*/];
                        snapshotResult = {};
                        allReady = true;
                        for (_i = 0, indicators_2 = indicators; _i < indicators_2.length; _i++) {
                            ind = indicators_2[_i];
                            result = PluginLoader_1.PluginLoader.safeUpdate(ind, event.candle);
                            snapshotResult[ind.name] = result;
                            if (!result.ready) {
                                allReady = false;
                            }
                        }
                        if (!allReady) return [3 /*break*/, 2];
                        trace = EventFactory_1.EventFactory.createTrace(event.trace.correlationId, event.eventId, // parentId = candle.eventId
                        this.engineId, event.trace.sequence // sequence preservation
                        );
                        nextEvent = EventFactory_1.EventFactory.createEvent('INDICATOR_UPDATED', robotId, event.configVersion, trace, { indicators: snapshotResult });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(nextEvent)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    IndicatorEngine.prototype.healthCheck = function () {
        return { status: this.status };
    };
    IndicatorEngine.prototype.ready = function () {
        return this.status === 'READY';
    };
    IndicatorEngine.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.unsubscribe) {
                    this.unsubscribe();
                    this.unsubscribe = null;
                }
                this.status = 'STOPPED';
                return [2 /*return*/];
            });
        });
    };
    return IndicatorEngine;
}());
exports.IndicatorEngine = IndicatorEngine;
