"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreIdempotencyStore = exports.IdempotencyStore = void 0;
/**
 * Hiến pháp Core Engine - Mục 11 & Golden Rule 9: Idempotency
 * Lưu trữ trạng thái để chặn xử lý trùng lặp.
 */
var IdempotencyStore = /** @class */ (function () {
    function IdempotencyStore() {
        // Trong môi trường Production, bộ nhớ này nên dùng Redis.
        // Ở giai đoạn Paper Trading, lưu In-Memory là đủ.
        this.processedKeys = new Set();
    }
    IdempotencyStore.prototype.hasSeen = function (key) {
        return this.processedKeys.has(key);
    };
    IdempotencyStore.prototype.markProcessed = function (key) {
        this.processedKeys.add(key);
    };
    IdempotencyStore.prototype.remove = function (key) {
        this.processedKeys.delete(key);
    };
    IdempotencyStore.prototype.clear = function () {
        this.processedKeys.clear();
    };
    return IdempotencyStore;
}());
exports.IdempotencyStore = IdempotencyStore;
exports.coreIdempotencyStore = new IdempotencyStore();
