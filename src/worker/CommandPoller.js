"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.CommandPoller = void 0;
var supabase_1 = require("@/lib/supabase");
var EventBus_1 = require("@/core/infrastructure/EventBus");
var diagnostics_1 = require("@/lib/diagnostics");
var CommandPoller = /** @class */ (function () {
    function CommandPoller(runtimeManager) {
        this.runtimeManager = runtimeManager;
        this.isPolling = false;
        this.currentDelay = 1000;
        this.minDelay = 1000;
        this.maxDelay = 2000;
        this.timer = null;
        this.supabase = (0, supabase_1.getSupabaseAdmin)();
    }
    CommandPoller.prototype.start = function () {
        if (this.isPolling)
            return;
        this.isPolling = true;
        this.poll();
    };
    CommandPoller.prototype.stop = function () {
        this.isPolling = false;
        if (this.timer)
            clearTimeout(this.timer);
    };
    CommandPoller.prototype.poll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var foundCommand, workerId, _a, commands, error, fullCmd, err_1;
            var _this = this;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.isPolling)
                            return [2 /*return*/];
                        foundCommand = false;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, , 7]);
                        workerId = process.env.WORKER_ID || 'PAPER-WORKER-01';
                        return [4 /*yield*/, this.supabase.rpc('claim_robot_commands', {
                                p_worker_id: workerId,
                                p_limit: 1
                            })];
                    case 2:
                        _a = _c.sent(), commands = _a.data, error = _a.error;
                        if (!error) return [3 /*break*/, 3];
                        console.error('[CommandPoller] Polling error:', error.message || error);
                        return [3 /*break*/, 5];
                    case 3:
                        if (!(commands && commands.length > 0)) return [3 /*break*/, 5];
                        foundCommand = true;
                        fullCmd = commands[0];
                        if (fullCmd.command_type === 'TV_SIGNAL' && ((_b = fullCmd.result) === null || _b === void 0 ? void 0 : _b.barTimestamp)) {
                            (0, diagnostics_1.upsertSignalTrace)({
                                robot_id: fullCmd.robot_id,
                                bar_timestamp: Number(fullCmd.result.barTimestamp),
                                poller_status: 'GREEN'
                            });
                        }
                        console.log(JSON.stringify({
                            event: 'COMMAND_POLLER_CLAIMED',
                            command_id: fullCmd.command_id,
                            correlation_id: fullCmd.correlation_id,
                            robot_id: fullCmd.robot_id
                        }));
                        return [4 /*yield*/, this.processCommand(fullCmd)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        err_1 = _c.sent();
                        console.error('[CommandPoller] Exception in poll:', err_1.message || err_1);
                        return [3 /*break*/, 7];
                    case 7:
                        if (this.isPolling) {
                            if (foundCommand) {
                                this.currentDelay = this.minDelay;
                            }
                            else {
                                this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
                            }
                            this.timer = setTimeout(function () { return _this.poll(); }, this.currentDelay);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    CommandPoller.prototype.processCommand = function (cmd) {
        return __awaiter(this, void 0, void 0, function () {
            var runtime, payload, lastCmd, result, _i, _a, ev, err_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 25, , 27]);
                        if (!(cmd.command_type === 'START')) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.runtimeManager.getOrCreateRuntime(cmd.robot_id)];
                    case 1:
                        _b.sent();
                        // Worker updates state
                        return [4 /*yield*/, this.supabase.from('robots').update({
                                status: 'RUNNING',
                                current_state: 'WAIT_SIGNAL',
                                trading_enabled: true
                            }).eq('id', cmd.robot_id)];
                    case 2:
                        // Worker updates state
                        _b.sent();
                        return [4 /*yield*/, this.completeCommand(cmd.command_id, 'SUCCEEDED', { message: 'Started' })];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 24];
                    case 4:
                        if (!(cmd.command_type === 'STOP')) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.runtimeManager.stopRuntime(cmd.robot_id)];
                    case 5:
                        _b.sent();
                        // Worker updates state
                        return [4 /*yield*/, this.supabase.from('robots').update({
                                status: 'STOPPED',
                                current_state: 'IDLE',
                                trading_enabled: false
                            }).eq('id', cmd.robot_id)];
                    case 6:
                        // Worker updates state
                        _b.sent();
                        return [4 /*yield*/, this.completeCommand(cmd.command_id, 'SUCCEEDED', { message: 'Stopped' })];
                    case 7:
                        _b.sent();
                        return [3 /*break*/, 24];
                    case 8:
                        if (!(cmd.command_type === 'TV_SIGNAL')) return [3 /*break*/, 22];
                        return [4 /*yield*/, this.runtimeManager.getOrCreateRuntime(cmd.robot_id)];
                    case 9:
                        runtime = _b.sent();
                        payload = cmd.result;
                        return [4 /*yield*/, this.supabase
                                .from('robot_commands')
                                .select('result')
                                .eq('robot_id', cmd.robot_id)
                                .eq('command_type', 'TV_SIGNAL')
                                .eq('status', 'SUCCEEDED')
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .single()];
                    case 10:
                        lastCmd = (_b.sent()).data;
                        if (lastCmd && lastCmd.result) {
                            payload.previousPayload = lastCmd.result.payload || lastCmd.result;
                        }
                        return [4 /*yield*/, this.runtimeManager.adapter.handleWebhook(payload, cmd.robot_id, cmd.correlation_id)];
                    case 11:
                        result = _b.sent();
                        if (!!result.accepted) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.completeCommand(cmd.command_id, 'FAILED', { validationErrors: result.validationErrors })];
                    case 12:
                        _b.sent();
                        return [2 /*return*/];
                    case 13:
                        if (!payload.isTest) return [3 /*break*/, 15];
                        console.log("[WORKER] TEST_ID=".concat(payload.testId));
                        return [4 /*yield*/, this.completeCommand(cmd.command_id, 'SUCCEEDED', __assign(__assign({}, payload), { execution: 'SKIPPED' }))];
                    case 14:
                        _b.sent();
                        return [2 /*return*/];
                    case 15:
                        if (!result.events) return [3 /*break*/, 19];
                        _i = 0, _a = result.events;
                        _b.label = 16;
                    case 16:
                        if (!(_i < _a.length)) return [3 /*break*/, 19];
                        ev = _a[_i];
                        return [4 /*yield*/, EventBus_1.coreEventBus.publish(ev.eventInstance)];
                    case 17:
                        _b.sent();
                        _b.label = 18;
                    case 18:
                        _i++;
                        return [3 /*break*/, 16];
                    case 19: 
                    // Wait for execution to finish
                    return [4 /*yield*/, EventBus_1.coreEventBus.waitForIdle(cmd.robot_id)];
                    case 20:
                        // Wait for execution to finish
                        _b.sent();
                        return [4 /*yield*/, this.completeCommand(cmd.command_id, 'SUCCEEDED', payload)];
                    case 21:
                        _b.sent();
                        return [3 /*break*/, 24];
                    case 22: return [4 /*yield*/, this.completeCommand(cmd.command_id, 'FAILED', { error: 'Unknown command_type' })];
                    case 23:
                        _b.sent();
                        _b.label = 24;
                    case 24: return [3 /*break*/, 27];
                    case 25:
                        err_2 = _b.sent();
                        console.log(JSON.stringify({
                            event: 'COMMAND_POLLER_ERROR',
                            command_id: cmd.command_id,
                            correlation_id: cmd.correlation_id,
                            safe_error: err_2.message || 'Unknown processing error'
                        }));
                        return [4 /*yield*/, this.completeCommand(cmd.command_id, 'FAILED', { error: err_2.message })];
                    case 26:
                        _b.sent();
                        return [3 /*break*/, 27];
                    case 27: return [2 /*return*/];
                }
            });
        });
    };
    CommandPoller.prototype.completeCommand = function (commandId, status, result) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.supabase.from('robot_commands').update({
                            status: status,
                            result: result
                        }).eq('command_id', commandId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return CommandPoller;
}());
exports.CommandPoller = CommandPoller;
