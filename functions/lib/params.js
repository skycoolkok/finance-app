"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FX_ADMIN_EMAILS = exports.CLICK_REDIRECT_URL = exports.APP_BASE_URL = exports.RESEND_API_KEY = void 0;
exports.getOpenPixelUrl = getOpenPixelUrl;
const params_1 = require("firebase-functions/params");
const OPEN_PIXEL_URL_PARAM = (0, params_1.defineSecret)('OPEN_PIXEL_URL');
exports.RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.APP_BASE_URL = (0, params_1.defineSecret)('APP_BASE_URL');
exports.CLICK_REDIRECT_URL = (0, params_1.defineSecret)('CLICK_REDIRECT_URL');
exports.FX_ADMIN_EMAILS = (0, params_1.defineSecret)('FX_ADMIN_EMAILS');
function getOpenPixelUrl() {
    try {
        const value = OPEN_PIXEL_URL_PARAM.value();
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    catch {
        // Secret not set; fall back to environment variable.
    }
    const envValue = process.env.OPEN_PIXEL_URL?.trim();
    return envValue && envValue.length > 0 ? envValue : undefined;
}
