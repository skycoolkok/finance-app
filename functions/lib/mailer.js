"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_EMAIL_SUBJECT = void 0;
exports.buildTestEmailHtml = buildTestEmailHtml;
exports.buildTestEmailText = buildTestEmailText;
exports.sendMail = sendMail;
const firebase_functions_1 = require("firebase-functions");
const resendClient_1 = require("./resendClient");
const DEFAULT_FROM = 'Finance App <notifications@finance-app.dev>';
exports.TEST_EMAIL_SUBJECT = 'Finance App Test Email';
function buildTestEmailHtml(baseUrl) {
    return [
        '<h1>Finance App</h1>',
        '<p>This is a test email from your notification system.</p>',
        `<p><a href="${baseUrl}">Open Finance App</a></p>`,
    ].join('');
}
function buildTestEmailText(baseUrl) {
    return `Finance App test email. Visit ${baseUrl}`;
}
async function sendMail(options) {
    const resend = await (0, resendClient_1.getResendClient)();
    const payload = {
        from: options.from ?? DEFAULT_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
    };
    const response = await resend.emails.send(payload);
    firebase_functions_1.logger.debug('Email dispatched via Resend.', {
        to: payload.to,
        subject: payload.subject,
    });
    return response;
}
