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
exports.coreEventBus = exports.EventBus = void 0;
var IdempotencyStore_1 = require("./IdempotencyStore");
var supabase_1 = require("../../lib/supabase");
/**
 * Hiến pháp Core Engine - Mục 18: EventBus Contract
 * Đảm bảo tính FIFO và Parallelism giữa các Robot.
 */
var EventBus = /** @class */ (function () {
    function EventBus() {
        this.handlers = new Map();
        // Queue event riêng cho từng Robot để đảm bảo FIFO
        this.queues = new Map();
        this.processing = new Map();
        // Added for Reliability Correction
        this.isShuttingDown = false;
        this.deadLetterQueues = new Map();
        this.pendingQueues = new Map();
        this.expectedSequences = new Map();
        this.currentProcessingSequences = new Map();
    }
    EventBus.prototype.subscribe = function (eventType, handler) {
        var _this = this;
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(handler);
        // Trả về hàm Unsubscribe
        return function () {
            var h = _this.handlers.get(eventType);
            if (!h)
                return;
            _this.handlers.set(eventType, h.filter(function (x) { return x !== handler; }));
        };
    };
    EventBus.prototype.publish = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var robotId, seq, expected, current, dlq, isRetry, isInternalCausal;
            return __generator(this, function (_a) {
                if (this.isShuttingDown) {
                    throw new Error('EventBus is shutting down');
                }
                robotId = event.robotId;
                console.error("[EventBus] publish called for ".concat(event.eventType, " seq: ").concat(event.trace.sequence));
                // Idempotency check
                if (IdempotencyStore_1.coreIdempotencyStore.hasSeen(event.idempotencyKey) || IdempotencyStore_1.coreIdempotencyStore.hasSeen(event.eventId)) {
                    return [2 /*return*/]; // Duplicate, silently ignore or log
                }
                IdempotencyStore_1.coreIdempotencyStore.markProcessed(event.idempotencyKey);
                IdempotencyStore_1.coreIdempotencyStore.markProcessed(event.eventId);
                if (!this.queues.has(robotId))
                    this.queues.set(robotId, []);
                if (!this.deadLetterQueues.has(robotId))
                    this.deadLetterQueues.set(robotId, []);
                if (!this.pendingQueues.has(robotId))
                    this.pendingQueues.set(robotId, []);
                if (!this.expectedSequences.has(robotId))
                    this.expectedSequences.set(robotId, event.trace.sequence);
                if (!this.currentProcessingSequences.has(robotId))
                    this.currentProcessingSequences.set(robotId, -1);
                seq = event.trace.sequence;
                expected = this.expectedSequences.get(robotId);
                current = this.currentProcessingSequences.get(robotId);
                dlq = this.deadLetterQueues.get(robotId) || [];
                isRetry = dlq.some(function (e) { return e.eventId === event.eventId; });
                if (isRetry) {
                    this.deadLetterQueues.set(robotId, dlq.filter(function (e) { return e.eventId !== event.eventId; }));
                }
                isInternalCausal = (seq === current);
                if (isInternalCausal) {
                    this.queues.get(robotId).unshift(event);
                    this.processQueue(robotId);
                    return [2 /*return*/];
                }
                if (seq > expected) {
                    // Out of order, hold in pending
                    this.pendingQueues.get(robotId).push(event);
                    return [2 /*return*/];
                }
                else if (seq < expected) {
                    if (isRetry) {
                        // Retry -> process it
                        this.queues.get(robotId).push(event);
                        this.processQueue(robotId);
                        return [2 /*return*/];
                    }
                    // Stale event, ignore
                    return [2 /*return*/];
                }
                // seq === expected
                this.queues.get(robotId).push(event);
                this.expectedSequences.set(robotId, expected + 1);
                // Check if any pending events can now be queued
                this.flushPending(robotId);
                // Kích hoạt worker xử lý queue của Robot này (Fire and forget)
                this.processQueue(robotId);
                return [2 /*return*/];
            });
        });
    };
    EventBus.prototype.flushPending = function (robotId) {
        var pending = this.pendingQueues.get(robotId);
        var expected = this.expectedSequences.get(robotId);
        var found = true;
        while (found) {
            found = false;
            var idx = pending.findIndex(function (e) { return e.trace.sequence === expected; });
            if (idx !== -1) {
                var ev = pending.splice(idx, 1)[0];
                this.queues.get(robotId).push(ev);
                expected++;
                this.expectedSequences.set(robotId, expected);
                found = true;
            }
        }
    };
    EventBus.prototype.processQueue = function (robotId) {
        return __awaiter(this, void 0, void 0, function () {
            var queue, event_1, handlers, _i, handlers_1, handler, error_1, AUDIT_EVENTS, NOISE_EVENTS, supabase, error, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Nếu queue đang được xử lý, bỏ qua để tránh race condition
                        if (this.processing.get(robotId))
                            return [2 /*return*/];
                        this.processing.set(robotId, true);
                        queue = this.queues.get(robotId);
                        _a.label = 1;
                    case 1:
                        if (!(queue.length > 0)) return [3 /*break*/, 12];
                        event_1 = queue.shift();
                        // Update current processing sequence
                        this.currentProcessingSequences.set(robotId, event_1.trace.sequence);
                        handlers = this.handlers.get(event_1.eventType) || [];
                        console.error("[EventBus] processing ".concat(event_1.eventType, " for ").concat(robotId, ". Handlers count: ").concat(handlers.length));
                        _i = 0, handlers_1 = handlers;
                        _a.label = 2;
                    case 2:
                        if (!(_i < handlers_1.length)) return [3 /*break*/, 7];
                        handler = handlers_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, handler(event_1)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error("[EventBus] Error processing event ".concat(event_1.eventType, " for robot ").concat(robotId), error_1);
                        this.deadLetterQueues.get(robotId).push(event_1);
                        IdempotencyStore_1.coreIdempotencyStore.remove(event_1.idempotencyKey);
                        IdempotencyStore_1.coreIdempotencyStore.remove(event_1.eventId);
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        AUDIT_EVENTS = [
                            'POSITION_OPENED_EVENT', 'POSITION_CLOSED_EVENT', 'TRADE_PLAN_EVENT',
                            'ORDER_CREATED_EVENT', 'ORDER_SUBMITTED_EVENT', 'ORDER_FILLED_EVENT',
                            'ORDER_CANCELLED_EVENT', 'ORDER_REJECTED_EVENT', 'RISK_REJECTED_EVENT',
                            'EXECUTION_ERROR_EVENT', 'SIGNAL_RECEIVED_EVENT', 'SIGNAL_ACCEPTED_EVENT',
                            'SIGNAL_REJECTED_EVENT', 'STOP_LOSS_EVENT', 'TAKE_PROFIT_EVENT', 'REVERSAL_EVENT',
                            'STATE_TRANSITION_EVENT', 'STRATEGY_SIGNAL_EVENT',
                            'POSITION_OPENED', 'POSITION_CLOSED', 'TRADE_PLAN', 'ORDER_CREATED',
                            'ORDER_SUBMITTED', 'ORDER_FILLED', 'ORDER_CANCELLED', 'ORDER_REJECTED',
                            'RISK_REJECTED', 'EXECUTION_ERROR', 'SIGNAL_RECEIVED', 'SIGNAL_ACCEPTED',
                            'SIGNAL_REJECTED', 'STOP_LOSS', 'TAKE_PROFIT', 'REVERSAL'
                        ];
                        NOISE_EVENTS = [
                            'REALTIME_PRICE_EVENT', 'PRICE_HEARTBEAT_EVENT', 'WORKER_HEARTBEAT',
                            'WORKER_HEARTBEAT_EVENT', 'SYSTEM_HEARTBEAT',
                            'REALTIME_PRICE_FEED_STALE', 'REALTIME_PRICE_FEED_CONNECTING',
                            'REALTIME_PRICE_FEED_DISCONNECTED', 'REALTIME_PRICE_FEED_CONNECTED',
                            'REALTIME_PRICE_FEED_STARTED',
                            'CANDLE_CLOSED', 'INDICATOR_UPDATED', 'STRATEGY_EVALUATED'
                        ];
                        if (NOISE_EVENTS.includes(event_1.eventType))
                            return [3 /*break*/, 1];
                        if (!AUDIT_EVENTS.includes(event_1.eventType)) {
                            console.warn("[EventBus] Unclassified event ".concat(event_1.eventType, " skipped from DB persistence"));
                            return [3 /*break*/, 1];
                        }
                        _a.label = 8;
                    case 8:
                        _a.trys.push([8, 10, , 11]);
                        supabase = (0, supabase_1.getSupabaseAdmin)();
                        return [4 /*yield*/, supabase.from('core_events').insert({
                                robot_id: event_1.robotId,
                                event_id: event_1.eventId,
                                event_type: event_1.eventType,
                                correlation_id: event_1.trace.correlationId,
                                parent_id: event_1.trace.parentId,
                                event_sequence: event_1.trace.sequence,
                                payload: event_1,
                                timestamp: event_1.timestamp
                            })];
                    case 9:
                        error = (_a.sent()).error;
                        console.log('[EventBus] Insert error:', error);
                        if (error) {
                            console.error("[EventBus] Persistence ERROR for event ".concat(event_1.eventType, " (seq: ").concat(event_1.trace.sequence, "):"), error);
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        err_1 = _a.sent();
                        console.error("[EventBus] Persistence EXCEPTION for event ".concat(event_1.eventType, " (seq: ").concat(event_1.trace.sequence, "):"), err_1);
                        return [3 /*break*/, 11];
                    case 11: return [3 /*break*/, 1];
                    case 12:
                        this.processing.set(robotId, false);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Chờ toàn bộ Event của một Robot được xử lý xong.
     * Rất quan trọng cho Automation Test và Shutdown Gracefully.
     */
    EventBus.prototype.waitForIdle = function (robotId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.processing.get(robotId) || (this.queues.get(robotId) && this.queues.get(robotId).length > 0))) return [3 /*break*/, 2];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5); })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 0];
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    EventBus.prototype.getDeadLetterQueue = function (robotId) {
        return this.deadLetterQueues.get(robotId) || [];
    };
    EventBus.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var promises, _i, _a, robotId, _b, _c, _d, robotId, pending;
            var _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        this.isShuttingDown = true;
                        promises = [];
                        for (_i = 0, _a = this.queues.keys(); _i < _a.length; _i++) {
                            robotId = _a[_i];
                            promises.push(this.waitForIdle(robotId));
                        }
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _f.sent();
                        // Drain pending queues to DLQ to prevent silent loss
                        for (_b = 0, _c = this.pendingQueues.entries(); _b < _c.length; _b++) {
                            _d = _c[_b], robotId = _d[0], pending = _d[1];
                            if (pending.length > 0) {
                                console.warn("[EventBus] Shutdown: Robot ".concat(robotId, " has ").concat(pending.length, " pending out-of-order events. Moving to DLQ."));
                                if (!this.deadLetterQueues.has(robotId))
                                    this.deadLetterQueues.set(robotId, []);
                                (_e = this.deadLetterQueues.get(robotId)).push.apply(_e, pending);
                                this.pendingQueues.set(robotId, []);
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    EventBus.prototype.clearAll = function () {
        this.handlers.clear();
        this.queues.clear();
        this.processing.clear();
        this.deadLetterQueues.clear();
        this.pendingQueues.clear();
        this.expectedSequences.clear();
        this.currentProcessingSequences.clear();
        this.isShuttingDown = false;
    };
    return EventBus;
}());
exports.EventBus = EventBus;
// Singleton instance cho toàn bộ Core Engine
exports.coreEventBus = new EventBus();
