"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdGenerator = void 0;
var uuid_1 = require("uuid");
var IdGenerator = /** @class */ (function () {
    function IdGenerator() {
    }
    IdGenerator.generate = function () {
        if (this.mockIdBase !== null) {
            this.counter++;
            return "".concat(this.mockIdBase, "-").concat(this.counter);
        }
        return (0, uuid_1.v4)();
    };
    IdGenerator.setDeterministic = function (baseId) {
        this.mockIdBase = baseId;
        this.counter = 0;
    };
    IdGenerator.reset = function () {
        this.mockIdBase = null;
        this.counter = 0;
    };
    IdGenerator.mockIdBase = null;
    IdGenerator.counter = 0;
    return IdGenerator;
}());
exports.IdGenerator = IdGenerator;
