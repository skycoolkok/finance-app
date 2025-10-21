"use strict";
// functions/src/mailer.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
const resendClient_1 = require("./resendClient");
async function sendMail(params) {
    const resend = await (0, resendClient_1.getResendClient)();
    if (!resend)
        throw new Error('Resend client not configured');
    const from = params.from || 'Finance App <onboarding@resend.dev>';
    const result = await resend.emails.send({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
    });
    return result;
}
