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
exports.StateMachineEngine = exports.RobotState = void 0;
var EventFactory_1 = require("../../infrastructure/EventFactory");
var EventBus_1 = require("../../infrastructure/EventBus");
var supabase_1 = require("../../../lib/supabase");
var RobotState;
(function (RobotState) {
    RobotState["WAIT_SIGNAL"] = "WAIT_SIGNAL";
    RobotState["WAIT_CANDLE_B_CONFIRMATION"] = "WAIT_CANDLE_B_CONFIRMATION";
    RobotState["READY_TO_ENTER"] = "READY_TO_ENTER";
    RobotState["POSITION_OPEN"] = "POSITION_OPEN";
})(RobotState || (exports.RobotState = RobotState = {}));
var StateMachineEngine = /** @class */ (function () {
    function StateMachineEngine() {
        this.engineId = 'StateMachineEngine_1';
        this.status = 'STOPPED';
        this.states = new Map();
        this.timeoutCounts = new Map();
        this.activeSignals = new Map();
        this.activePositions = new Map();
        this.signalSystemTimestamps = new Map();
        this.armedSignals = new Map(); // Kept for backwards compatibility if needed, but not used for business logic
        this.robotTimeframes = new Map();
        this.unsubs = [];
    }
    StateMachineEngine.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.status = 'STARTING';
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('STRATEGY_SIGNAL_EVENT', function (e) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handleSignalDetected(e)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }));
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('REALTIME_PRICE_EVENT', function (e) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handleRealtimePrice(e)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }));
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('POSITION_OPENED_EVENT', function (e) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handlePositionOpened(e)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }));
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('POSITION_CLOSED_EVENT', function (e) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handlePositionClosed(e)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }));
                this.unsubs.push(EventBus_1.coreEventBus.subscribe('RISK_REJECTED_EVENT', function (e) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.handleRiskRejected(e)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); }));
                this.intervalId = setInterval(function () { return _this.checkTimeouts(); }, 5000);
                this.status = 'READY';
                return [2 /*return*/];
            });
        });
    };
    StateMachineEngine.prototype.getTimeframeDurationMs = function (timeframe) {
        var tf = timeframe.toLowerCase();
        if (tf === '1m')
            return 60000;
        if (tf === '3m')
            return 3 * 60000;
        if (tf === '5m')
            return 5 * 60000;
        if (tf === '10m')
            return 10 * 60000;
        if (tf === '15m')
            return 15 * 60000;
        if (tf === '30m')
            return 30 * 60000;
        if (tf === '45m')
            return 45 * 60000;
        if (tf === '1h')
            return 60 * 60000;
        return 60000; // default 1m
    };
    StateMachineEngine.prototype.registerRobot = function (robotId, timeframe) {
        if (timeframe === void 0) { timeframe = '1m'; }
        this.robotTimeframes.set(robotId, timeframe.toLowerCase());
        this.states.set(robotId, RobotState.WAIT_SIGNAL);
    };
    StateMachineEngine.prototype.handleSignalDetected = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, currentState, timeframe, durationMs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[StateMachineEngine] handleSignalDetected:', event.eventType, event.direction);
                        if (event.direction === 'NONE')
                            return [2 /*return*/];
                        robotId = event.robotId;
                        currentState = this.states.get(robotId) || RobotState.WAIT_SIGNAL;
                        if (currentState === RobotState.POSITION_OPEN) {
                            console.log("[StateMachineEngine] POSITION_ALREADY_OPEN for robot ".concat(robotId, ": Ignoring new signal."));
                            return [2 /*return*/];
                        }
                        if (!(currentState === RobotState.WAIT_SIGNAL || currentState === RobotState.WAIT_CANDLE_B_CONFIRMATION)) return [3 /*break*/, 2];
                        this.states.set(robotId, RobotState.WAIT_CANDLE_B_CONFIRMATION);
                        this.activeSignals.set(robotId, event);
                        this.armedSignals.set(robotId, false);
                        this.timeoutCounts.set(robotId, 0); // Reset timeout
                        // signalSystemTimestamps is no longer used for business logic, relying on event.payload.barTimestamp
                        return [4 /*yield*/, this.persistState(robotId, RobotState.WAIT_CANDLE_B_CONFIRMATION)];
                    case 1:
                        // signalSystemTimestamps is no longer used for business logic, relying on event.payload.barTimestamp
                        _a.sent();
                        timeframe = this.robotTimeframes.get(robotId) || '1m';
                        durationMs = (event.maxTimeoutCandles || 3) * this.getTimeframeDurationMs(timeframe);
                        console.log(JSON.stringify({
                            event: 'TIMEOUT_STARTED',
                            robot_id: robotId,
                            timeframe: timeframe,
                            correlation_id: event.trace.correlationId,
                            signal_bar_timestamp: event.barTimestamp,
                            signal_time_utc: new Date(event.barTimestamp || Date.now()).toISOString(),
                            timeout_duration_ms: durationMs
                        }));
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.handleRealtimePrice = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, currentState, activeSignal, currentPrice, trigger, armBounds, cancelBounds, isCancelled, getSupabaseAdmin_1, e_1, trace, transitionEvent, isArmed, isTriggered, trace, transitionEvent, getSupabaseAdmin_2, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (event.price <= 0 || event.eventTimestamp <= 0) {
                            return [2 /*return*/];
                        }
                        robotId = event.robotId;
                        currentState = this.states.get(robotId);
                        if (!(currentState === RobotState.WAIT_CANDLE_B_CONFIRMATION)) return [3 /*break*/, 14];
                        activeSignal = this.activeSignals.get(robotId);
                        if (!activeSignal)
                            return [2 /*return*/];
                        currentPrice = event.price;
                        trigger = activeSignal.entryTrigger;
                        armBounds = activeSignal.armBounds;
                        cancelBounds = activeSignal.cancelBounds;
                        isCancelled = false;
                        if (cancelBounds) {
                            if (currentPrice < cancelBounds.lower || currentPrice > cancelBounds.upper) {
                                isCancelled = true;
                            }
                        }
                        if (!isCancelled) return [3 /*break*/, 7];
                        this.states.set(robotId, RobotState.WAIT_SIGNAL);
                        return [4 /*yield*/, this.persistState(robotId, RobotState.WAIT_SIGNAL)];
                    case 1:
                        _a.sent();
                        this.activeSignals.delete(robotId);
                        this.armedSignals.delete(robotId);
                        this.signalSystemTimestamps.delete(robotId);
                        this.armedSignals.delete(robotId);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        getSupabaseAdmin_1 = require('../../../lib/supabase').getSupabaseAdmin;
                        return [4 /*yield*/, getSupabaseAdmin_1().from('active_setups').delete().eq('robot_id', robotId)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _a.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        trace = EventFactory_1.EventFactory.createTrace(activeSignal.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
                        transitionEvent = EventFactory_1.EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
                            previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
                            newState: RobotState.WAIT_SIGNAL,
                            reason: 'CANCEL_TRIGGER_HIT',
                            triggerPrice: currentPrice
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(transitionEvent)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                    case 7:
                        isArmed = this.armedSignals.get(robotId) || false;
                        if (!isArmed && armBounds) {
                            if (currentPrice >= armBounds.lower && currentPrice <= armBounds.upper) {
                                isArmed = true;
                                this.armedSignals.set(robotId, true);
                                console.log("[StateMachineEngine] SIGNAL ARMED for ".concat(robotId, " at price ").concat(currentPrice));
                            }
                        }
                        isTriggered = false;
                        // ONLY trigger if Armed
                        if (isArmed && trigger) {
                            if (currentPrice >= trigger.lower && currentPrice <= trigger.upper) {
                                isTriggered = true;
                            }
                        }
                        if (!isTriggered) return [3 /*break*/, 14];
                        this.armedSignals.delete(robotId);
                        trace = EventFactory_1.EventFactory.createTrace(activeSignal.trace.correlationId, event.eventId, this.engineId, event.trace.sequence + 1);
                        this.states.set(robotId, RobotState.READY_TO_ENTER);
                        this.timeoutCounts.set(robotId, 0);
                        return [4 /*yield*/, this.persistState(robotId, RobotState.READY_TO_ENTER)];
                    case 8:
                        _a.sent();
                        transitionEvent = EventFactory_1.EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
                            oldState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
                            newState: RobotState.READY_TO_ENTER,
                            triggerPrice: currentPrice,
                            strategyId: activeSignal.strategyId
                        });
                        _a.label = 9;
                    case 9:
                        _a.trys.push([9, 11, , 12]);
                        getSupabaseAdmin_2 = require('../../../lib/supabase').getSupabaseAdmin;
                        return [4 /*yield*/, getSupabaseAdmin_2().from('active_setups').delete().eq('robot_id', robotId)];
                    case 10:
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        e_2 = _a.sent();
                        return [3 /*break*/, 12];
                    case 12: return [4 /*yield*/, EventBus_1.coreEventBus.publish(transitionEvent)];
                    case 13:
                        _a.sent();
                        this.activeSignals.delete(robotId);
                        _a.label = 14;
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.handlePositionOpened = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, currentState, trace, transitionEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.activePositions.set(event.robotId, { side: event.side, sl: event.stopLoss, tp: event.takeProfit, symbol: event.symbol });
                        robotId = event.robotId;
                        currentState = this.states.get(robotId);
                        if (!(currentState === RobotState.READY_TO_ENTER)) return [3 /*break*/, 3];
                        this.states.set(robotId, RobotState.POSITION_OPEN);
                        return [4 /*yield*/, this.persistState(robotId, RobotState.POSITION_OPEN)];
                    case 1:
                        _a.sent();
                        trace = EventFactory_1.EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
                        transitionEvent = EventFactory_1.EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
                            previousState: RobotState.READY_TO_ENTER,
                            newState: RobotState.POSITION_OPEN,
                            reason: 'POSITION_OPENED'
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(transitionEvent)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        console.warn("[StateMachineEngine] REJECTED POSITION_OPENED_EVENT for ".concat(robotId, ". Invalid state: ").concat(currentState));
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.handlePositionClosed = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, currentState, trace, transitionEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.activePositions.delete(event.robotId);
                        robotId = event.robotId;
                        currentState = this.states.get(robotId);
                        if (!(currentState === RobotState.POSITION_OPEN)) return [3 /*break*/, 3];
                        this.states.set(robotId, RobotState.WAIT_SIGNAL);
                        return [4 /*yield*/, this.persistState(robotId, RobotState.WAIT_SIGNAL)];
                    case 1:
                        _a.sent();
                        trace = EventFactory_1.EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
                        transitionEvent = EventFactory_1.EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
                            previousState: RobotState.POSITION_OPEN,
                            newState: RobotState.WAIT_SIGNAL,
                            reason: 'POSITION_CLOSED'
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(transitionEvent)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        console.warn("[StateMachineEngine] REJECTED POSITION_CLOSED_EVENT for ".concat(robotId, ". Invalid state: ").concat(currentState));
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.handleRiskRejected = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, currentState, trace, transitionEvent;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        robotId = event.robotId;
                        currentState = this.states.get(robotId);
                        if (!(currentState === RobotState.READY_TO_ENTER)) return [3 /*break*/, 3];
                        this.states.set(robotId, RobotState.WAIT_SIGNAL);
                        return [4 /*yield*/, this.persistState(robotId, RobotState.WAIT_SIGNAL)];
                    case 1:
                        _a.sent();
                        trace = EventFactory_1.EventFactory.createTrace(event.trace.correlationId, event.eventId, this.engineId, event.trace.sequence);
                        transitionEvent = EventFactory_1.EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, event.configVersion || 1, trace, {
                            previousState: RobotState.READY_TO_ENTER,
                            newState: RobotState.WAIT_SIGNAL,
                            reason: 'RISK_REJECTED'
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(transitionEvent)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.checkTimeouts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, _i, _a, _b, robotId, state, activeSignal, timeframe, timeframeMs, maxTimeout, maxTimeoutMs, signalBarTimestamp, elapsedMs, trace, transitionEvent;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        now = Date.now();
                        _i = 0, _a = this.states.entries();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        _b = _a[_i], robotId = _b[0], state = _b[1];
                        if (!(state === RobotState.WAIT_CANDLE_B_CONFIRMATION)) return [3 /*break*/, 4];
                        activeSignal = this.activeSignals.get(robotId);
                        if (!activeSignal) return [3 /*break*/, 4];
                        if (activeSignal.persistent)
                            return [3 /*break*/, 4];
                        timeframe = this.robotTimeframes.get(robotId);
                        if (!timeframe) {
                            console.error("[StateMachineEngine] CONFIG_ERROR for ".concat(robotId, ": Missing timeframe config"));
                            return [3 /*break*/, 4]; // FAIL SAFE
                        }
                        timeframeMs = this.getTimeframeDurationMs(timeframe);
                        maxTimeout = activeSignal.maxTimeoutCandles || 3;
                        maxTimeoutMs = maxTimeout * timeframeMs;
                        signalBarTimestamp = activeSignal.barTimestamp;
                        if (!signalBarTimestamp) {
                            console.error("[StateMachineEngine] TIMEOUT_STATE_INVALID for ".concat(robotId, ": Missing signal barTimestamp"));
                            return [3 /*break*/, 4]; // FAIL SAFE
                        }
                        elapsedMs = now - signalBarTimestamp;
                        if (!(elapsedMs >= maxTimeoutMs)) return [3 /*break*/, 4];
                        console.log(JSON.stringify({
                            event: 'RETRACEMENT_TIMEOUT',
                            robot_id: robotId,
                            timeframe: timeframe,
                            correlation_id: activeSignal.trace.correlationId,
                            signal_bar_timestamp: signalBarTimestamp,
                            timeout_at: new Date(now).toISOString(),
                            elapsed_ms: elapsedMs,
                            timeout_duration_ms: maxTimeoutMs,
                            reason: 'TIME_BASED_TIMEOUT'
                        }));
                        this.states.set(robotId, RobotState.WAIT_SIGNAL);
                        return [4 /*yield*/, this.persistState(robotId, RobotState.WAIT_SIGNAL)];
                    case 2:
                        _c.sent();
                        this.signalSystemTimestamps.delete(robotId);
                        this.armedSignals.delete(robotId);
                        trace = EventFactory_1.EventFactory.createTrace(activeSignal.trace.correlationId, 'TIMEOUT_' + now, this.engineId, now);
                        transitionEvent = EventFactory_1.EventFactory.createEvent('STATE_TRANSITION_EVENT', robotId, 1, trace, {
                            previousState: RobotState.WAIT_CANDLE_B_CONFIRMATION,
                            newState: RobotState.WAIT_SIGNAL,
                            reason: 'TIMEOUT'
                        });
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(transitionEvent)];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.getState = function (robotId) {
        return this.states.get(robotId);
    };
    StateMachineEngine.prototype.persistState = function (robotId, state) {
        return __awaiter(this, void 0, void 0, function () {
            var supabase, error, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        supabase = (0, supabase_1.getSupabaseAdmin)();
                        return [4 /*yield*/, supabase.from('robots').update({
                                current_state: state,
                                current_state_updated_at: new Date().toISOString()
                            }).eq('id', robotId)];
                    case 1:
                        error = (_a.sent()).error;
                        if (!(error && error.code === '22P02')) return [3 /*break*/, 3];
                        return [4 /*yield*/, supabase.from('robots').update({
                                current_state: state,
                                current_state_updated_at: new Date().toISOString()
                            }).eq('name', robotId)];
                    case 2:
                        error = (_a.sent()).error;
                        _a.label = 3;
                    case 3:
                        if (error) {
                            console.error("[StateMachineEngine] Persistence ERROR for ".concat(robotId, ":"), error);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _a.sent();
                        console.error("[StateMachineEngine] Persistence EXCEPTION for ".concat(robotId, ":"), err_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    StateMachineEngine.prototype.healthCheck = function () { return { status: this.status }; };
    StateMachineEngine.prototype.ready = function () { return this.status === 'READY'; };
    StateMachineEngine.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, unsub;
            return __generator(this, function (_b) {
                for (_i = 0, _a = this.unsubs; _i < _a.length; _i++) {
                    unsub = _a[_i];
                    unsub();
                }
                this.unsubs = [];
                if (this.intervalId)
                    clearInterval(this.intervalId);
                this.status = 'STOPPED';
                return [2 /*return*/];
            });
        });
    };
    return StateMachineEngine;
}());
exports.StateMachineEngine = StateMachineEngine;
