"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToken = exports.sendTestPush = exports.ping = void 0;
// functions/src/index.ts
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const options_1 = require("firebase-functions/v2/options");
const firebase_functions_1 = require("firebase-functions");
const resend_1 = require("resend");
// 1) 全域設定（v2 正確用法，取代舊版 functions.region(...)）
const REGION = 'asia-east1';
(0, options_1.setGlobalOptions)({
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
});
// 2) 初始化 Admin（避免重複初始化）
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const firestore = admin.firestore();
const messaging = admin.messaging();
// 3) Resend（可選）：從環境變數讀 API Key（Emulator 支援 functions/.env）
const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new resend_1.Resend(resendApiKey) : null;
if (!resendClient) {
    firebase_functions_1.logger.warn('RESEND_API_KEY not set. Email notifications will be skipped.');
}
// 方便 UI 測試：24 小時視窗
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
// -------------------------------
// Ping：健康檢查/測路徑/看環境
// -------------------------------
exports.ping = (0, https_1.onCall)(async (request) => {
    return {
        ok: true,
        echo: request.data ?? null,
        env: {
            emulator: process.env.FUNCTIONS_EMULATOR === 'true',
            projectId: process.env.GCLOUD_PROJECT,
            region: REGION,
        },
    };
});
// -----------------------------------------
// sendTestPush：Emulator 直接回 mock；真環境就發推播
// -----------------------------------------
exports.sendTestPush = (0, https_1.onCall)(async ({ data }) => {
    const userId = (data?.userId ?? '').toString().trim();
    if (!userId)
        throw new Error('missing userId');
    // Emulator：不打真正的 FCM，直接回傳 mock
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
        return { mocked: true, sent: true, userId, note: 'Emulator mock response' };
    }
    // 真環境：示範用 topic = userId 發推播（按你的實際需求調整）
    await messaging.send({
        topic: `user_${userId}`,
        notification: { title: 'Hello', body: 'This is a test push' },
    });
    return { mocked: false, sent: true, userId };
});
exports.registerToken = (0, https_1.onCall)(async (request) => {
    const token = (request.data?.token ?? '').toString().trim();
    const userId = (request.data?.userId ?? request.auth?.uid ?? '').toString() || null;
    if (!token) {
        throw new Error('missing token');
    }
    // 寫入 Firestore（依你資料模型調整）
    await firestore.collection('pushTokens').doc(token).set({
        uid: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        windowMs: NOTIFICATION_WINDOW_MS,
    }, { merge: true });
    return { ok: true, token, userId };
});
