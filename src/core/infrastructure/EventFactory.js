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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventFactory = void 0;
var Clock_1 = require("./Clock");
var IdGenerator_1 = require("./IdGenerator");
var EventFactory = /** @class */ (function () {
    function EventFactory() {
    }
    EventFactory.createTrace = function (correlationId, parentId, engineId, sequence) {
        return {
            traceId: IdGenerator_1.IdGenerator.generate(),
            correlationId: correlationId,
            parentId: parentId,
            engineId: engineId,
            sequence: sequence
        };
    };
    EventFactory.createEvent = function (eventType, robotId, configVersion, trace, payload) {
        var eventId = IdGenerator_1.IdGenerator.generate();
        var timestamp = Clock_1.Clock.now();
        // Golden Rule 9: Idempotency Key tự sinh từ bối cảnh
        var idempotencyKey = "".concat(robotId, "-").concat(eventType, "-").concat(trace.correlationId, "-").concat(trace.sequence);
        return __assign(__assign({}, payload), { eventId: eventId, eventType: eventType, idempotencyKey: idempotencyKey, eventVersion: 'v1.0.0', schemaVersion: '1.0.0', robotId: robotId, configVersion: configVersion, trace: trace, timestamp: timestamp });
    };
    return EventFactory;
}());
exports.EventFactory = EventFactory;
