"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FX_ADMIN_EMAILS = exports.APP_BASE_URL = exports.RESEND_API_KEY = void 0;
exports.getOpenPixelUrl = getOpenPixelUrl;
exports.getClickRedirectUrl = getClickRedirectUrl;
const params_1 = require("firebase-functions/params");
const IS_DEPLOY_PHASE = process.env.FUNCTIONS_CONTROL_API === 'true';
const OPEN_PIXEL_URL_PARAM = IS_DEPLOY_PHASE ? undefined : (0, params_1.defineSecret)('OPEN_PIXEL_URL');
const CLICK_REDIRECT_URL_PARAM = IS_DEPLOY_PHASE ? undefined : (0, params_1.defineSecret)('CLICK_REDIRECT_URL');
exports.RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.APP_BASE_URL = (0, params_1.defineSecret)('APP_BASE_URL');
exports.FX_ADMIN_EMAILS = (0, params_1.defineSecret)('FX_ADMIN_EMAILS');
function getOpenPixelUrl() {
    if (OPEN_PIXEL_URL_PARAM) {
        try {
            const value = OPEN_PIXEL_URL_PARAM.value();
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        catch {
            // Secret not set; fall back to environment variable.
        }
    }
    const envValue = process.env.OPEN_PIXEL_URL?.trim();
    return envValue && envValue.length > 0 ? envValue : undefined;
}
function getClickRedirectUrl() {
    if (CLICK_REDIRECT_URL_PARAM) {
        try {
            const value = CLICK_REDIRECT_URL_PARAM.value();
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        catch {
            // Secret not set; fall back to environment variable.
        }
    }
    const envValue = process.env.CLICK_REDIRECT_URL?.trim();
    return envValue && envValue.length > 0 ? envValue : undefined;
}
