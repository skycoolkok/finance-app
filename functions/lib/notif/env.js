"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_APP_BASE_URL = void 0;
exports.getAppBaseUrl = getAppBaseUrl;
const firebase_functions_1 = require("firebase-functions");
const FALLBACK_APP_BASE_URL = 'https://finance-app-sigma-jet.vercel.app';
exports.FALLBACK_APP_BASE_URL = FALLBACK_APP_BASE_URL;
let cachedBaseUrl = null;
function getAppBaseUrl() {
    if (cachedBaseUrl) {
        return cachedBaseUrl;
    }
    const envUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
    if (envUrl) {
        cachedBaseUrl = envUrl;
        return cachedBaseUrl;
    }
    cachedBaseUrl = FALLBACK_APP_BASE_URL;
    firebase_functions_1.logger.warn('APP_BASE_URL not configured; using fallback URL.', {
        fallback: FALLBACK_APP_BASE_URL,
    });
    return cachedBaseUrl;
}
function normalizeBaseUrl(value) {
    const trimmed = value?.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const normalized = new URL(trimmed).toString();
        return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
    }
    catch {
        firebase_functions_1.logger.warn('Invalid APP_BASE_URL provided; ignoring value.', { value: trimmed });
        return null;
    }
}
