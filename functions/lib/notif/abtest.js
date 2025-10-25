"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignVariant = assignVariant;
const node_crypto_1 = require("node:crypto");
function assignVariant(input) {
    const key = `${input.userId}:${input.eventKey}:${input.channel ?? 'email'}`;
    const hash = (0, node_crypto_1.createHash)('sha256').update(key).digest();
    return hash[0] % 2 === 0 ? 'A' : 'B';
}
