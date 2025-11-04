// functions/src/index.ts  (暫時最小化入口)
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';

// 初始化（避免重複初始化造成本機/模擬器報錯）
try {
  admin.initializeApp();
} catch {
  console.log('Admin already initialized or running in local emulator');
}

// 最小健康檢查：只回傳 200 OK
export const health = onRequest((req, res) => {
  res.status(200).send('OK from Firebase Functions v2');
});
