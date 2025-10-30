"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clickRedirect = void 0;
exports.resolveClickRedirectUrl = resolveClickRedirectUrl;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("../params");
const env_1 = require("../notif/env");
const TRACKING_OPTIONS = {
    region: 'asia-east1',
    cpu: 1,
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [params_1.APP_BASE_URL, params_1.CLICK_REDIRECT_URL],
};
exports.clickRedirect = (0, https_1.onRequest)(TRACKING_OPTIONS, async (req, res) => {
    const targetUrl = resolveTargetUrl(req.query);
    const status = 302;
    try {
        const { nid, variant, uid, event } = req.query ?? {};
        firebase_functions_1.logger.debug('clickRedirect event', { nid, variant, uid, event, targetUrl });
    }
    catch (error) {
        firebase_functions_1.logger.warn('Failed to log click redirect event', { error });
    }
    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Allow-Origin', '*');
    res.redirect(status, targetUrl);
});
function resolveTargetUrl(query) {
    const base = (0, env_1.getAppBaseUrl)();
    if (!query) {
        return base;
    }
    const raw = (Array.isArray(query.url) ? query.url[0] : query.url) ??
        (Array.isArray(query.target) ? query.target[0] : query.target) ??
        null;
    if (!raw) {
        return base;
    }
    const decoded = decodeTarget(raw);
    if (!decoded) {
        return base;
    }
    try {
        const url = new URL(decoded);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            return url.toString();
        }
    }
    catch {
        // ignore invalid
    }
    return base;
}
function decodeTarget(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        return decodeURIComponent(trimmed);
    }
    catch {
        // ignore
    }
    try {
        const buffer = Buffer.from(trimmed, 'base64');
        return buffer.toString('utf8');
    }
    catch {
        return trimmed;
    }
}
function resolveClickRedirectUrl(defaultBase = (0, env_1.getAppBaseUrl)()) {
    return (0, env_1.getClickRedirectUrl)() ?? `${defaultBase}/api/track/click`;
}
