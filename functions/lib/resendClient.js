"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingResendApiKeyError = void 0;
exports.getResendClient = getResendClient;
exports.getResendClientOrNull = getResendClientOrNull;
const resend_1 = require("resend");
const params_1 = require("./params");
let cachedClient = null;
let cachedKey = null;
class MissingResendApiKeyError extends Error {
    constructor() {
        super('RESEND_API_KEY is not configured');
        this.name = 'MissingResendApiKeyError';
    }
}
exports.MissingResendApiKeyError = MissingResendApiKeyError;
async function getResendClient() {
    const apiKey = params_1.RESEND_API_KEY.value();
    if (!apiKey) {
        throw new MissingResendApiKeyError();
    }
    if (!cachedClient || cachedKey !== apiKey) {
        cachedClient = new resend_1.Resend(apiKey);
        cachedKey = apiKey;
    }
    return cachedClient;
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
