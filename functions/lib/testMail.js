"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestEmailGet = void 0;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const env_1 = require("./notif/env");
const params_1 = require("./params");
const lazy_1 = require("./lib/lazy");
const getMailer = (0, lazy_1.memo)(() => require('./mailer'));
const getResendClientModule = (0, lazy_1.memo)(() => require('./resendClient'));
const REGION = 'asia-east1';
const HTTPS_OPTIONS = {
    region: REGION,
    cpu: 1,
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [params_1.RESEND_API_KEY, params_1.APP_BASE_URL],
};
exports.sendTestEmailGet = (0, https_1.onRequest)(HTTPS_OPTIONS, async (req, res) => {
    if (req.method !== 'GET') {
        res.set('Allow', 'GET');
        res.status(405).send('Method Not Allowed');
        return;
    }
    const recipient = normalizeQueryValue(req.query.to);
    if (!recipient) {
        res.status(400).json({ error: 'Missing "to" query parameter.' });
        return;
    }
    const baseUrl = (0, env_1.getAppBaseUrl)();
    const mailer = getMailer();
    const resendClientModule = getResendClientModule();
    try {
        await mailer.sendMail({
            to: recipient,
            subject: mailer.TEST_EMAIL_SUBJECT,
            html: mailer.buildTestEmailHtml(baseUrl),
            text: mailer.buildTestEmailText(baseUrl),
        });
    }
    catch (error) {
        if (error instanceof resendClientModule.MissingResendApiKeyError) {
            res.status(500).json({ error: 'RESEND_API_KEY is not configured.' });
            return;
        }
        firebase_functions_1.logger.error('Failed to dispatch test email via HTTP endpoint.', normalizeError(error), {
            recipient,
        });
        res.status(500).json({ error: 'Failed to send test email.' });
        return;
    }
    res.status(200).json({
        delivered: true,
        to: recipient,
        subject: mailer.TEST_EMAIL_SUBJECT,
    });
});
function normalizeQueryValue(value) {
    if (typeof value === 'string') {
        return value.trim();
    }
    if (Array.isArray(value) && value.length > 0) {
        return normalizeQueryValue(value[0]);
    }
    return '';
}
function normalizeError(error) {
    if (error instanceof Error) {
        return { message: error.message };
    }
    return { message: 'Unknown error' };
}
