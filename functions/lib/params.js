"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FX_ADMIN_EMAILS = exports.CLICK_REDIRECT_URL = exports.OPEN_PIXEL_URL = exports.APP_BASE_URL = exports.RESEND_API_KEY = void 0;
const params_1 = require("firebase-functions/params");
exports.RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.APP_BASE_URL = (0, params_1.defineSecret)('APP_BASE_URL');
exports.OPEN_PIXEL_URL = (0, params_1.defineSecret)('OPEN_PIXEL_URL');
exports.CLICK_REDIRECT_URL = (0, params_1.defineSecret)('CLICK_REDIRECT_URL');
exports.FX_ADMIN_EMAILS = (0, params_1.defineSecret)('FX_ADMIN_EMAILS');
