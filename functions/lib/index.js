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
exports.scheduledReminders = exports.sendTestEmail = exports.sendTestPush = exports.registerToken = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const resend_1 = require("resend");
const REGION = 'asia-east1';
if (!admin.apps.length) {
    admin.initializeApp();
}
const firestore = admin.firestore();
const messaging = admin.messaging();
const resendClient = (() => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        functions.logger.warn('RESEND_API_KEY is not configured. Email notifications will be skipped.');
        return null;
    }
    return new resend_1.Resend(apiKey);
})();
const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
exports.registerToken = functions.region(REGION).https.onCall(async (data, context) => {
    const token = typeof data?.token === 'string' ? data.token.trim() : '';
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'token is required');
    }
    const userId = context.auth?.uid ?? (typeof data?.userId === 'string' ? data.userId : '');
    if (!userId) {
        throw new functions.https.HttpsError('failed-precondition', 'Authentication is required to register a token');
    }
    const platform = typeof data?.platform === 'string' ? data.platform : 'unknown';
    const sanitizedId = sanitizeForKey(`${userId}:${token}`);
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
exports.sendTestPush = functions.region(REGION).https.onCall(async (data, context) => {
    const userId = context.auth?.uid ?? (typeof data?.userId === 'string' ? data.userId : '');
    if (!userId) {
        throw new functions.https.HttpsError('failed-precondition', 'Authentication is required to send a test push notification');
    }
    const tokens = await fetchUserTokens(userId);
    if (tokens.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No device tokens registered for this user');
    }
    const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
            title: 'Finance App',
            body: 'Test push notification from Finance App.',
        },
        data: {
            type: 'test-push',
        },
    });
    await logNotification({
        userId,
        type: 'test-push',
        message: 'Test push notification dispatched.',
        channel: 'push',
        eventKey: 'test-push',
    });
    return { successCount: response.successCount, failureCount: response.failureCount };
});
exports.sendTestEmail = functions.region(REGION).https.onCall(async (data, context) => {
    if (!resendClient) {
        throw new functions.https.HttpsError('failed-precondition', 'RESEND_API_KEY is not configured');
    }
    const userId = context.auth?.uid ?? (typeof data?.userId === 'string' ? data.userId : '');
    if (!userId) {
        throw new functions.https.HttpsError('failed-precondition', 'Authentication is required to send a test email');
    }
    const userRecord = await admin
        .auth()
        .getUser(userId)
        .catch(() => null);
    const email = userRecord?.email || (typeof data?.email === 'string' ? data.email : '');
    if (!email) {
        throw new functions.https.HttpsError('failed-precondition', 'No email address available for this user');
    }
    await resendClient.emails.send({
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
exports.scheduledReminders = functions
    .region(REGION)
    .pubsub.schedule('every 6 hours')
    .onRun(async () => {
    const cardsSnapshot = await firestore.collection('cards').get();
    if (cardsSnapshot.empty) {
        functions.logger.info('No cards found for reminder processing.');
        return null;
    }
    const now = new Date();
    const dueThresholds = new Set([7, 3, 1, 0]);
    const tokenCache = new Map();
    const emailCache = new Map();
    for (const cardDoc of cardsSnapshot.docs) {
        const card = cardDoc.data();
        const userId = card.userId;
        if (!userId || !card.statementDay || !card.dueDay || typeof card.limitAmount !== 'number') {
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
            const message = formatDueMessage(cardLabel, daysToDue, dueDate, currentDue);
            reminders.push({
                userId,
                cardId: cardDoc.id,
                cardLabel,
                eventKey: `card:${cardDoc.id}:due:${daysToDue}`,
                type: 'due-reminder',
                message,
                pushTitle: 'Card payment reminder',
                emailSubject: 'Card payment reminder',
            });
        }
        if (utilization >= 0.95) {
            const message = `${cardLabel} has reached ${Math.round(utilization * 100)}% of its credit limit.`;
            reminders.push({
                userId,
                cardId: cardDoc.id,
                cardLabel,
                eventKey: `card:${cardDoc.id}:utilization:95`,
                type: 'utilization-95',
                message,
                pushTitle: 'High utilization alert',
                emailSubject: 'High utilization alert',
            });
        }
        else if (utilization >= 0.8) {
            const message = `${cardLabel} has used ${Math.round(utilization * 100)}% of its credit limit.`;
            reminders.push({
                userId,
                cardId: cardDoc.id,
                cardLabel,
                eventKey: `card:${cardDoc.id}:utilization:80`,
                type: 'utilization-80',
                message,
                pushTitle: 'Utilization warning',
                emailSubject: 'Utilization warning',
            });
        }
        for (const reminder of reminders) {
            await deliverReminder({ reminder, tokenCache, emailCache });
        }
    }
    return null;
});
async function deliverReminder({ reminder, tokenCache, emailCache }) {
    const { userId, eventKey, message, pushTitle, emailSubject, type } = reminder;
    const shouldSendPush = !(await wasEventSentRecently(userId, eventKey, 'push'));
    if (shouldSendPush) {
        const tokens = await fetchUserTokens(userId, tokenCache);
        if (tokens.length > 0) {
            await messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title: pushTitle,
                    body: message,
                },
                data: {
                    type,
                    cardId: reminder.cardId,
                    eventKey,
                },
            });
            await logNotification({
                userId,
                type,
                message,
                channel: 'push',
                eventKey,
            });
            await rememberNotificationKey(userId, eventKey, 'push');
        }
    }
    if (resendClient) {
        const shouldSendEmail = !(await wasEventSentRecently(userId, eventKey, 'email'));
        if (shouldSendEmail) {
            const email = await lookupUserEmail(userId, emailCache);
            if (email) {
                await resendClient.emails.send({
                    from: 'Finance App <notifications@finance-app.dev>',
                    to: email,
                    subject: emailSubject,
                    html: `<h2>${emailSubject}</h2><p>${message}</p>`,
                });
                await logNotification({
                    userId,
                    type,
                    message,
                    channel: 'email',
                    eventKey,
                });
                await rememberNotificationKey(userId, eventKey, 'email');
            }
        }
    }
}
async function fetchUserTokens(userId, cache) {
    if (cache?.has(userId)) {
        return cache.get(userId) ?? [];
    }
    const snapshot = await firestore.collection('user_tokens').where('userId', '==', userId).get();
    const tokens = snapshot.docs
        .map(docSnapshot => docSnapshot.data().token)
        .filter((token) => Boolean(token));
    cache?.set(userId, tokens);
    return tokens;
}
async function lookupUserEmail(userId, cache) {
    if (cache.has(userId)) {
        return cache.get(userId) ?? null;
    }
    const userRecord = await admin
        .auth()
        .getUser(userId)
        .catch(() => null);
    const email = userRecord?.email ?? null;
    cache.set(userId, email);
    return email;
}
async function wasEventSentRecently(userId, eventKey, channel) {
    const docRef = notificationKeyRef(userId, eventKey, channel);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
        return false;
    }
    const sentAt = snapshot.get('sentAt');
    if (!sentAt) {
        return false;
    }
    return sentAt.toMillis() >= Date.now() - NOTIFICATION_WINDOW_MS;
}
async function rememberNotificationKey(userId, eventKey, channel) {
    const docRef = notificationKeyRef(userId, eventKey, channel);
    await docRef.set({
        userId,
        eventKey,
        channel,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
function notificationKeyRef(userId, eventKey, channel) {
    const docId = sanitizeForKey(`${userId}:${channel}:${eventKey}`);
    return firestore.collection('notif_keys').doc(docId);
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
async function logNotification({ userId, type, message, channel, eventKey, }) {
    await firestore.collection('notifications').add({
        userId,
        type,
        message,
        channel,
        eventKey,
        read: false,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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
function formatDueMessage(cardLabel, daysToDue, dueDate, currentDue) {
    const dueDisplay = dueDate.toDateString();
    const amountDisplay = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(currentDue);
    if (daysToDue < 0) {
        return `${cardLabel} payment was due on ${dueDisplay}. Outstanding balance: ${amountDisplay}.`;
    }
    if (daysToDue === 0) {
        return `${cardLabel} payment is due today (${dueDisplay}). Balance: ${amountDisplay}.`;
    }
    if (daysToDue === 1) {
        return `${cardLabel} payment is due tomorrow (${dueDisplay}). Balance: ${amountDisplay}.`;
    }
    return `${cardLabel} payment is due in ${daysToDue} days on ${dueDisplay}. Balance: ${amountDisplay}.`;
}
function sanitizeForKey(value) {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}
__exportStar(require("./new-apis"), exports);
