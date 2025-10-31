"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FX_ADMIN_EMAILS = exports.RESEND_API_KEY = void 0;
exports.getBaseUrl = getBaseUrl;
exports.getOpenPixelUrl = getOpenPixelUrl;
exports.getClickRedirectUrl = getClickRedirectUrl;
const params_1 = require("firebase-functions/params");
const lazy_1 = require("./lib/lazy");
const IS_DEPLOY_PHASE = process.env.FUNCTIONS_CONTROL_API === 'true';
const APP_BASE_URL_PARAM = IS_DEPLOY_PHASE ? undefined : (0, params_1.defineSecret)('APP_BASE_URL');
const OPEN_PIXEL_URL_PARAM = IS_DEPLOY_PHASE ? undefined : (0, params_1.defineSecret)('OPEN_PIXEL_URL');
const CLICK_REDIRECT_URL_PARAM = IS_DEPLOY_PHASE ? undefined : (0, params_1.defineSecret)('CLICK_REDIRECT_URL');
exports.RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.FX_ADMIN_EMAILS = (0, params_1.defineSecret)('FX_ADMIN_EMAILS');
const DEFAULT_BASE_URL = 'https://finance-app.local';
const readBaseUrl = (0, lazy_1.memo)(() => {
    const secretValue = readOptionalSecret(APP_BASE_URL_PARAM);
    if (secretValue) {
        return secretValue;
    }
    const envValue = process.env.APP_BASE_URL?.trim();
    if (envValue && envValue.length > 0) {
        return envValue;
    }
    return DEFAULT_BASE_URL;
});
function getBaseUrl() {
    return readBaseUrl();
}
function getOpenPixelUrl() {
    const secretValue = readOptionalSecret(OPEN_PIXEL_URL_PARAM);
    if (secretValue) {
        return secretValue;
    }
    const envValue = process.env.OPEN_PIXEL_URL?.trim();
    return envValue && envValue.length > 0 ? envValue : undefined;
}
function getClickRedirectUrl() {
    const secretValue = readOptionalSecret(CLICK_REDIRECT_URL_PARAM);
    if (secretValue) {
        return secretValue;
    }
    const envValue = process.env.CLICK_REDIRECT_URL?.trim();
    return envValue && envValue.length > 0 ? envValue : undefined;
}
function readOptionalSecret(param) {
    if (!param) {
        return undefined;
    }
    try {
        const value = param.value();
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }
    }
    catch {
        // Access during deploy or secret missing; fall back to env/default.
    }
    return undefined;
}
