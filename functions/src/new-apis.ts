// functions/src/index.ts
import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { logger } from 'firebase-functions';
import { Resend } from 'resend';

// 1) 全域設定（v2 正確用法，取代舊版 functions.region(...)）
const REGION = 'asia-east1';
setGlobalOptions({
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
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;
if (!resendClient) {
  logger.warn('RESEND_API_KEY not set. Email notifications will be skipped.');
}

// 方便 UI 測試：24 小時視窗
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

// -------------------------------
// Ping：健康檢查/測路徑/看環境
// -------------------------------
export const ping = onCall(async (request) => {
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
export const sendTestPush = onCall<{ userId?: string }>(async ({ data }) => {
  const userId = (data?.userId ?? '').toString().trim();
  if (!userId) throw new Error('missing userId');

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

// -------------------------------------------------------
// registerToken：儲存用戶裝置 Token（避免 any、補齊型別）
// -------------------------------------------------------
type RegisterTokenData = { token: string; userId?: string };

export const registerToken = onCall<RegisterTokenData>(async (request) => {
  const token = (request.data?.token ?? '').toString().trim();
  const userId = (request.data?.userId ?? request.auth?.uid ?? '').toString() || null;

  if (!token) {
    throw new Error('missing token');
  }

  // 寫入 Firestore（依你資料模型調整）
  await firestore.collection('pushTokens').doc(token).set(
    {
      uid: userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      windowMs: NOTIFICATION_WINDOW_MS,
    },
    { merge: true },
  );

  return { ok: true, token, userId };
});
