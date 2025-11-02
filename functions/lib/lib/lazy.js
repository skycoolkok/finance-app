"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memo = memo;
function memo(factory) {
    let cached;
    return () => {
        if (cached === undefined) {
            cached = factory();
        }
        return cached;
    };
}
