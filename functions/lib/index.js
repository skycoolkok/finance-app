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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestEmailGet = exports.scheduledBudget = exports.setUserLocale = exports.sendTestEmail = exports.sendTestPush = exports.registerToken = void 0;
require("dotenv/config");
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const engine_1 = require("./notif/engine");
const env_1 = require("./notif/env");
const budgetEngine_1 = require("./notif/budgetEngine");
const utils_1 = require("./notif/utils");
const mailer_1 = require("./mailer");
const resendClient_1 = require("./resendClient");
const templates_1 = require("./templates");
const testMail_1 = require("./testMail");
Object.defineProperty(exports, "sendTestEmailGet", { enumerable: true, get: function () { return testMail_1.sendTestEmailGet; } });
const REGION = 'asia-east1';
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const HTTPS_OPTIONS = {
    region: REGION,
    cpu: 1,
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [resendClient_1.RESEND_API_KEY],
};
const SCHEDULE_OPTIONS = {
    region: REGION,
    schedule: 'every 6 hours',
    timeZone: 'Asia/Taipei',
    cpu: 1,
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [resendClient_1.RESEND_API_KEY],
};
if (!admin.apps.length) {
    admin.initializeApp();
}
const firestore = admin.firestore();
const messaging = admin.messaging();
const APP_BASE_URL = (0, env_1.getAppBaseUrl)();
exports.registerToken = (0, https_1.onCall)(HTTPS_OPTIONS, async (request) => {
    const token = typeof request.data?.token === 'string' ? request.data.token.trim() : '';
    if (!token) {
        throw new https_1.HttpsError('invalid-argument', 'token is required');
    }
    const userId = request.auth?.uid ?? (typeof request.data?.userId === 'string' ? request.data.userId : '');
    if (!userId) {
        throw new https_1.HttpsError('failed-precondition', 'Authentication is required to register a token');
    }
    const platform = typeof request.data?.platform === 'string' ? request.data.platform : 'unknown';
    const sanitizedId = (0, utils_1.sanitizeForKey)(`${userId}:${token}`);
    const tokenRef = firestore.collection('user_tokens').doc(sanitizedId);
    await firestore.runTransaction(async (tx) => {
        const snapshot = await tx.get(tokenRef);
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        if (snapshot.exists) {
            tx.update(tokenRef, {
                token,
                userId,
                platform,
                updatedAt: timestamp,
            });
        }
        else {
            tx.set(tokenRef, {
                token,
                userId,
                platform,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        }
    });
    return { token };
});
exports.sendTestPush = (0, https_1.onCall)(HTTPS_OPTIONS, async (request) => {
    const userId = request.auth?.uid ?? (typeof request.data?.userId === 'string' ? request.data.userId : '');
    if (!userId) {
        throw new https_1.HttpsError('failed-precondition', 'Authentication is required to send a test push notification');
    }
    const tokens = await fetchUserTokens(userId);
    if (tokens.length === 0) {
        throw new https_1.HttpsError('failed-precondition', 'No device tokens registered for this user');
    }
    const locale = await (0, engine_1.fetchUserLocale)({ firestore, userId });
    const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
            title: 'Finance App',
            body: 'Test push notification from Finance App.',
        },
        data: {
            type: 'test-push',
            url: APP_BASE_URL,
            locale,
        },
    });
    await (0, engine_1.logNotificationRecord)(firestore, {
        userId,
        type: 'test-push',
        message: 'Test push notification dispatched.',
        channel: 'push',
        eventKey: 'test-push',
        locale,
    });
    return { successCount: response.successCount, failureCount: response.failureCount };
});
exports.sendTestEmail = (0, https_1.onCall)(HTTPS_OPTIONS, async (request) => {
    const userId = request.auth?.uid ?? (typeof request.data?.userId === 'string' ? request.data.userId : '');
    if (!userId) {
        throw new https_1.HttpsError('failed-precondition', 'Authentication is required to send a test email');
    }
    const userRecord = await admin
        .auth()
        .getUser(userId)
        .catch(() => null);
    const email = userRecord?.email ??
        (typeof request.data?.email === 'string' ? request.data.email.trim() : '');
    if (!email) {
        throw new https_1.HttpsError('failed-precondition', 'No email address available for this user');
    }
    const locale = await (0, engine_1.fetchUserLocale)({ firestore, userId });
    try {
        await (0, mailer_1.sendMail)({
            to: email,
            subject: mailer_1.TEST_EMAIL_SUBJECT,
            html: (0, mailer_1.buildTestEmailHtml)(APP_BASE_URL),
            text: (0, mailer_1.buildTestEmailText)(APP_BASE_URL),
        });
    }
    catch (error) {
        if (error instanceof resendClient_1.MissingResendApiKeyError) {
            throw new https_1.HttpsError('failed-precondition', 'RESEND_API_KEY is not configured');
        }
        firebase_functions_1.logger.error('Failed to send test email.', normalizeError(error), {
            userId,
            email,
        });
        throw new https_1.HttpsError('internal', 'Unable to send test email');
    }
    await (0, engine_1.logNotificationRecord)(firestore, {
        userId,
        type: 'test-email',
        message: 'Test email notification dispatched.',
        channel: 'email',
        eventKey: 'test-email',
        locale,
    });
    return { delivered: true };
});
exports.setUserLocale = (0, https_1.onCall)(HTTPS_OPTIONS, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('failed-precondition', 'Authentication is required to update locale');
    }
    const localeInput = typeof request.data?.locale === 'string' ? request.data.locale.trim() : '';
    if (!localeInput) {
        throw new https_1.HttpsError('invalid-argument', 'locale is required');
    }
    const normalized = (0, templates_1.resolveLocaleTag)(localeInput);
    await firestore
        .collection('users')
        .doc(userId)
        .set({
        locale: normalized,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { locale: normalized };
});
exports.scheduledBudget = (0, scheduler_1.onSchedule)(SCHEDULE_OPTIONS, async () => {
    const resendClient = await (0, resendClient_1.getResendClientOrNull)();
    if (!resendClient) {
        firebase_functions_1.logger.warn('RESEND_API_KEY is not configured. Email notifications will be skipped.');
    }
    const notificationEngine = new engine_1.NotificationEngine({
        firestore,
        messaging,
        resendClient,
        notificationWindowMs: NOTIFICATION_WINDOW_MS,
        baseUrl: APP_BASE_URL,
        logger: firebase_functions_1.logger,
    });
    await processCardReminders(notificationEngine);
    await processBudgetAlerts(notificationEngine);
});
__exportStar(require("./new-apis"), exports);
async function fetchUserTokens(userId) {
    const snapshot = await firestore.collection('user_tokens').where('userId', '==', userId).get();
    return snapshot.docs
        .map(docSnapshot => docSnapshot.data().token)
        .filter((token) => Boolean(token));
}
async function sumTransactions({ userId, cardId, start, end, }) {
    const startISO = toISODate(start);
    const endISO = toISODate(end);
    const snapshot = await firestore
        .collection('transactions')
        .where('userId', '==', userId)
        .where('cardId', '==', cardId)
        .where('affectCurrentBill', '==', true)
        .where('date', '>=', startISO)
        .where('date', '<=', endISO)
        .get();
    return snapshot.docs.reduce((total, docSnapshot) => {
        const amount = docSnapshot.data().amount;
        return total + (typeof amount === 'number' ? amount : 0);
    }, 0);
}
function computeCycle(todayInput, statementDay) {
    const today = normalizeDate(todayInput);
    const currentMonthStatement = new Date(today.getFullYear(), today.getMonth(), statementDay);
    const cycleEnd = today.getDate() <= statementDay
        ? currentMonthStatement
        : new Date(today.getFullYear(), today.getMonth() + 1, statementDay);
    const previousCycleEnd = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() - 1, statementDay);
    const cycleStart = new Date(previousCycleEnd);
    cycleStart.setDate(previousCycleEnd.getDate() + 1);
    return { start: cycleStart, end: cycleEnd };
}
function computeDueDate(cycleEndInput, dueDay) {
    const cycleEnd = normalizeDate(cycleEndInput);
    let dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), dueDay);
    if (dueDate <= cycleEnd) {
        dueDate = new Date(cycleEnd.getFullYear(), cycleEnd.getMonth() + 1, dueDay);
    }
    return dueDate;
}
function calculateDaysLeft(from, to) {
    const diffMs = normalizeDate(to).getTime() - normalizeDate(from).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
function normalizeDate(value) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
function toISODate(date) {
    return normalizeDate(date).toISOString().split('T')[0];
}
async function processCardReminders(notificationEngine) {
    const cardsSnapshot = await firestore.collection('cards').get();
    if (cardsSnapshot.empty) {
        firebase_functions_1.logger.info('No cards found for reminder processing.');
        return;
    }
    const now = new Date();
    const dueThresholds = new Set([7, 3, 1, 0]);
    for (const cardDoc of cardsSnapshot.docs) {
        const card = cardDoc.data();
        const userId = typeof card.userId === 'string' ? card.userId : undefined;
        if (!userId || typeof card.statementDay !== 'number' || typeof card.dueDay !== 'number') {
            continue;
        }
        if (typeof card.limitAmount !== 'number') {
            continue;
        }
        const cycle = computeCycle(now, card.statementDay);
        const dueDate = computeDueDate(cycle.end, card.dueDay);
        const daysToDue = calculateDaysLeft(now, dueDate);
        const currentDue = await sumTransactions({
            userId,
            cardId: cardDoc.id,
            start: cycle.start,
            end: cycle.end,
        });
        const utilization = card.limitAmount > 0 ? currentDue / card.limitAmount : 0;
        const cardLabel = card.alias || card.issuer || `Card ${card.last4 ?? ''}`;
        const reminders = [];
        if (dueThresholds.has(daysToDue) || daysToDue < 0) {
            reminders.push({
                userId,
                cardId: cardDoc.id,
                eventKey: `card:${cardDoc.id}:due:${daysToDue}`,
                type: 'due-reminder',
                template: {
                    kind: 'due',
                    data: {
                        cardLabel,
                        daysToDue,
                        dueDate,
                        amount: currentDue,
                    },
                },
            });
        }
        if (utilization >= 0.95) {
            reminders.push({
                userId,
                cardId: cardDoc.id,
                eventKey: `card:${cardDoc.id}:utilization:95`,
                type: 'utilization-95',
                template: {
                    kind: 'utilization',
                    data: {
                        cardLabel,
                        utilization,
                        threshold: 95,
                        limit: card.limitAmount,
                        amount: currentDue,
                    },
                },
            });
        }
        else if (utilization >= 0.8) {
            reminders.push({
                userId,
                cardId: cardDoc.id,
                eventKey: `card:${cardDoc.id}:utilization:80`,
                type: 'utilization-80',
                template: {
                    kind: 'utilization',
                    data: {
                        cardLabel,
                        utilization,
                        threshold: 80,
                        limit: card.limitAmount,
                        amount: currentDue,
                    },
                },
            });
        }
        for (const reminder of reminders) {
            await notificationEngine.deliverReminder(reminder);
        }
    }
}
async function processBudgetAlerts(notificationEngine) {
    const budgetsSnapshot = await firestore.collection('budgets').get();
    if (budgetsSnapshot.empty) {
        firebase_functions_1.logger.info('No budgets found for alert processing.');
        return;
    }
    for (const budgetDoc of budgetsSnapshot.docs) {
        const data = budgetDoc.data();
        const userId = typeof data.userId === 'string' && data.userId.trim().length > 0
            ? data.userId.trim()
            : null;
        if (!userId) {
            continue;
        }
        const limit = toPositiveNumber(data.limitAmount ?? data.limit ?? data.amountLimit ?? data.total ?? null);
        const spent = toPositiveNumber(data.spent ?? data.spentAmount ?? data.current ?? data.currentSpend ?? null);
        const thresholds = normalizeThresholds(data.thresholds ?? data.alertThresholds ?? null);
        const budgetLabel = determineBudgetLabel(data, budgetDoc.id);
        if (limit <= 0 && spent <= 0) {
            continue;
        }
        const usagePercentage = limit > 0 ? (spent / limit) * 100 : Number.POSITIVE_INFINITY;
        for (const threshold of thresholds) {
            if (usagePercentage >= threshold) {
                await (0, budgetEngine_1.sendBudgetAlert)(notificationEngine, {
                    userId,
                    budgetId: budgetDoc.id,
                    budgetLabel,
                    spent,
                    limit,
                    threshold,
                });
            }
        }
    }
}
function toPositiveNumber(value) {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) && num > 0 ? num : 0;
}
function normalizeThresholds(value) {
    const raw = Array.isArray(value) ? value : value != null ? [value] : [80, 100];
    const thresholds = raw
        .map(entry => {
        const numeric = typeof entry === 'number' ? entry : Number(entry);
        return Number.isFinite(numeric) ? numeric : null;
    })
        .filter((entry) => entry !== null)
        .map(entry => Math.max(0, entry));
    if (thresholds.length === 0) {
        return [80, 100];
    }
    return Array.from(new Set(thresholds)).sort((a, b) => a - b);
}
function determineBudgetLabel(data, fallbackId) {
    const labelCandidates = [
        data.budgetLabel,
        data.label,
        data.name,
        data.title,
        `Budget ${fallbackId}`,
    ];
    for (const candidate of labelCandidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }
    return `Budget ${fallbackId}`;
}
function normalizeError(error) {
    if (error instanceof Error) {
        return { message: error.message };
    }
    return { message: 'Unknown error' };
}
