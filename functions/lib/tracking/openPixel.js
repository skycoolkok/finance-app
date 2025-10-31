"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openPixel = void 0;
exports.resolveOpenPixelUrl = resolveOpenPixelUrl;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("../params");
const env_1 = require("../notif/env");
const GIF_BASE64 = 'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
const GIF_BUFFER = Buffer.from(GIF_BASE64, 'base64');
const TRACKING_OPTIONS = {
    region: 'asia-east1',
    cpu: 1,
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [params_1.APP_BASE_URL],
};
exports.openPixel = (0, https_1.onRequest)(TRACKING_OPTIONS, async (req, res) => {
    try {
        const { nid, variant, uid, event } = req.query ?? {};
        firebase_functions_1.logger.debug('openPixel beacon received', {
            nid,
            variant,
            uid,
            event,
            source: req.headers['user-agent'],
        });
    }
    catch (error) {
        firebase_functions_1.logger.warn('Failed to log open pixel event', { error });
    }
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.set('Content-Length', GIF_BUFFER.length.toString());
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(GIF_BUFFER);
});
function resolveOpenPixelUrl() {
    return (0, env_1.getOpenPixelUrl)();
}
