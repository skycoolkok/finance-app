"use strict";
// functions/src/index.ts
// － 完整支援 Firebase 2nd Gen + Secret Manager + Resend 正式版（不使用 SecretParam / getSecretValue）－
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestEmailGet = exports.scheduledBudget = exports.sendTestEmail = exports.sendTestPush = exports.registerToken = void 0;
const admin = __importStar(require("firebase-admin"));
// v2 imports
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const params_1 = require("firebase-functions/params");
// 你自己的模組
const resendClient_1 = require("./resendClient");
const budgetEngine_1 = require("./notif/budgetEngine");
const mailer_1 = require("./mailer");
// ----------------------------------------------------------------------------
// Secret / Region
// ----------------------------------------------------------------------------
const RESEND_API_KEY = (0, params_1.defineSecret)('RESEND_API_KEY');
const REGION = 'asia-east1';
// ----------------------------------------------------------------------------
// 初始化
// ----------------------------------------------------------------------------
admin.initializeApp();
const firestore = admin.firestore();
const messaging = admin.messaging();
const callableCommon = {
    region: REGION,
    invoker: 'public',
    secrets: [RESEND_API_KEY], // 可變陣列型別 (string | SecretParam)[]
};
const httpsCommon = {
    region: REGION,
    invoker: 'public',
    secrets: [RESEND_API_KEY],
};
const scheduleCommon = {
    region: REGION,
    secrets: [RESEND_API_KEY],
};
// ----------------------------------------------------------------------------
// registerToken（v2 onCall）
// ----------------------------------------------------------------------------
exports.registerToken = (0, https_1.onCall)(callableCommon, async (req) => {
    const token = typeof req.data?.token === 'string' ? req.data.token.trim() : '';
    if (!token)
        throw new Error('invalid-argument: token is required');
    const userId = req.auth?.uid ?? (typeof req.data?.userId === 'string' ? req.data.userId : '');
    if (!userId)
        throw new Error('failed-precondition: Authentication required');
    const platform = typeof req?.data?.platform === 'string'
        ? req.data.platform
        : 'unknown';
    const sanitizedId = sanitizeForKey(`${userId}:${token}`);
    const tokenRef = firestore.collection('user_tokens').doc(sanitizedId);
    await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(tokenRef);
        const now = admin.firestore.FieldValue.serverTimestamp();
        if (snap.exists) {
            tx.update(tokenRef, { token, userId, platform, updatedAt: now });
        }
        else {
            tx.set(tokenRef, { token, userId, platform, createdAt: now, updatedAt: now });
        }
    });
    return { token };
});
// ----------------------------------------------------------------------------
// sendTestPush（v2 onCall）
// ----------------------------------------------------------------------------
exports.sendTestPush = (0, https_1.onCall)(callableCommon, async (req) => {
    const userId = req.auth?.uid ?? (typeof req.data?.userId === 'string' ? req.data.userId : '');
    if (!userId)
        throw new Error('failed-precondition: Authentication required');
    const resp = await sendPushToUser(userId, {
        title: 'Finance App',
        body: 'Test push notification from Finance App.',
        data: { type: 'test-push' },
    });
    if (resp.successCount === 0)
        throw new Error('failed-precondition: No device tokens for this user');
    await logNotification({
        userId,
        type: 'test-push',
        message: 'Test push notification dispatched.',
        channel: 'push',
        eventKey: 'test-push',
    });
    return { successCount: resp.successCount, failureCount: resp.failureCount };
});
// ----------------------------------------------------------------------------
// sendTestEmail（v2 onCall）
// ----------------------------------------------------------------------------
exports.sendTestEmail = (0, https_1.onCall)(callableCommon, async (req) => {
    const resend = await (0, resendClient_1.getResendClient)();
    if (!resend)
        return { delivered: false, reason: 'RESEND_API_KEY not configured' };
    const userId = req.auth?.uid ?? (typeof req.data?.userId === 'string' ? req.data.userId : '');
    if (!userId)
        throw new Error('failed-precondition: Authentication required');
    const userRecord = await admin.auth().getUser(userId).catch(() => null);
    const email = userRecord?.email || (typeof req.data?.email === 'string' ? req.data.email : '');
    if (!email)
        throw new Error('failed-precondition: No email for this user');
    await resend.emails.send({
        from: 'Finance App <notifications@finance-app.dev>',
        to: email,
        subject: 'Finance App Test Email',
        html: '<h1>Finance App</h1><p>This is a test email from your notification system.</p>',
    });
    await logNotification({
        userId,
        type: 'test-email',
        message: `Test email sent to ${email}.`,
        channel: 'email',
        eventKey: 'test-email',
    });
    return { delivered: true };
});
// ----------------------------------------------------------------------------
exports.scheduledBudget = (0, scheduler_1.onSchedule)({
    ...scheduleCommon,
    schedule: 'every 6 hours',
    timeZone: 'Asia/Taipei',
}, async () => {
    await (0, budgetEngine_1.budgetEngine)({
        firestore,
        resendClient: await (0, resendClient_1.getResendClient)(),
        sendPushToUser,
        logNotification,
        rememberNotificationKey,
        wasEventSentRecently,
        lookupUserEmail,
    });
});
// ----------------------------------------------------------------------------
exports.sendTestEmailGet = (0, https_1.onRequest)(httpsCommon, async (req, res) => {
    try {
        if (req.method !== 'GET' && req.method !== 'POST') {
            res.status(405).json({ ok: false, error: 'Only GET or POST allowed' });
            return;
        }
        const to = (req.method === 'GET'
            ? req.query.to
            : req.body?.to) || 'you@example.com';
        const result = await (0, mailer_1.sendMail)({
            to,
            subject: 'Hello from Firebase + Resend',
            html: '<p>It works 🎉</p>',
            from: 'Finance App <onboarding@resend.dev>',
        });
        res.json({ ok: true, result });
    }
    catch (err) {
        logger.error(err);
        res.status(500).json({ ok: false, error: err?.message ?? 'Unexpected error' });
    }
});
async function fetchUserTokens(userId) {
    const snap = await firestore
        .collection('user_tokens')
        .where('userId', '==', userId)
        .get();
    return snap.docs
        .map((d) => d.data().token)
        .filter((t) => Boolean(t));
}
async function sendPushToUser(userId, payload) {
    const tokens = await fetchUserTokens(userId);
    if (tokens.length === 0)
        return { successCount: 0, failureCount: 0 };
    const resp = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
    });
    return { successCount: resp.successCount, failureCount: resp.failureCount };
}
async function logNotification(args) {
    await firestore.collection('notifications').add({
        ...args,
        read: false,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
function notificationKeyRef(userId, eventKey, channel) {
    const docId = sanitizeForKey(`${userId}:${channel}:${eventKey}`);
    return firestore.collection('notif_keys').doc(docId);
}
async function rememberNotificationKey(userId, eventKey, channel) {
    const ref = notificationKeyRef(userId, eventKey, channel);
    await ref.set({
        userId,
        eventKey,
        channel,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
const NOTIF_WINDOW_MS = 24 * 60 * 60 * 1000;
async function wasEventSentRecently(userId, eventKey, channel) {
    const ref = notificationKeyRef(userId, eventKey, channel);
    const snap = await ref.get();
    if (!snap.exists)
        return false;
    const sentAt = snap.get('sentAt');
    if (!sentAt)
        return false;
    return sentAt.toMillis() >= Date.now() - NOTIF_WINDOW_MS;
}
async function lookupUserEmail(userId) {
    const rec = await admin.auth().getUser(userId).catch(() => null);
    return rec?.email ?? null;
}
function sanitizeForKey(v) {
    return v.replace(/[^a-zA-Z0-9_-]/g, '_');
}
__exportStar(require("./testMail"), exports);
