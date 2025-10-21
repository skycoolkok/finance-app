"use strict";
// functions/src/resendClient.ts
// 讀取由 Secret Manager 注入的環境變數（2nd Gen 會在執行時注入 process.env）
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResendClient = getResendClient;
const resend_1 = require("resend");
async function getResendClient() {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.warn('[Resend] Missing RESEND_API_KEY (process.env).');
        return null;
    }
    return new resend_1.Resend(key);
}
