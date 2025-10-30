"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingResendApiKeyError = void 0;
exports.getResendClient = getResendClient;
exports.getResendClientOrNull = getResendClientOrNull;
const resend_1 = require("resend");
const lazy_1 = require("./lib/lazy");
const params_1 = require("./params");
class MissingResendApiKeyError extends Error {
    constructor() {
        super('RESEND_API_KEY is not configured');
        this.name = 'MissingResendApiKeyError';
    }
}
exports.MissingResendApiKeyError = MissingResendApiKeyError;
const getResendInternal = (0, lazy_1.memo)(() => {
    const apiKey = params_1.RESEND_API_KEY.value();
    if (!apiKey) {
        throw new MissingResendApiKeyError();
    }
    return new resend_1.Resend(apiKey);
});
async function getResendClient() {
    return getResendInternal();
}
async function getResendClientOrNull() {
    try {
        return await getResendClient();
    }
    catch (error) {
        if (error instanceof MissingResendApiKeyError) {
            return null;
        }
        throw error;
    }
}
