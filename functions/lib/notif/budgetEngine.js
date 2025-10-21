"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetEngine = budgetEngine;
const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});
async function budgetEngine({ firestore, resendClient, sendPushToUser, logNotification, rememberNotificationKey, wasEventSentRecently, lookupUserEmail, }) {
    const budgetsSnapshot = await firestore.collection('budgets').get();
    if (budgetsSnapshot.empty) {
        return [];
    }
    const tokenCache = new Map();
    const emailCache = new Map();
    const now = new Date();
    const results = [];
    for (const docSnapshot of budgetsSnapshot.docs) {
        try {
            const data = docSnapshot.data();
            const budgetId = docSnapshot.id;
            const userId = data.userId ?? '';
            const limit = typeof data.limit === 'number' ? data.limit : 0;
            const category = (data.category ?? '').trim();
            if (!userId || limit <= 0 || !category) {
                results.push({
                    budgetId,
                    category,
                    spent: data.spent ?? 0,
                    limit,
                    thresholdTriggered: null,
                });
                continue;
            }
            const { startDate, endDate, periodStartISO } = resolvePeriodRange({
                period: data.period,
                startDate: data.startDate,
                endDate: data.endDate,
                reference: now,
            });
            if (!startDate || !endDate) {
                results.push({
                    budgetId,
                    category,
                    spent: data.spent ?? 0,
                    limit,
                    thresholdTriggered: null,
                });
                continue;
            }
            const startISO = toISODate(startDate);
            const endISO = toISODate(endDate);
            const normalizedCategory = sanitizeCategory(category);
            const transactionsSnapshot = await firestore
                .collection('transactions')
                .where('userId', '==', userId)
                .where('category', '==', category)
                .where('date', '>=', startISO)
                .where('date', '<=', endISO)
                .get();
            const spent = transactionsSnapshot.docs.reduce((total, txDoc) => {
                const tx = txDoc.data();
                if (sanitizeCategory(tx.category ?? '') !== normalizedCategory) {
                    return total;
                }
                const amount = typeof tx.amount === 'number' ? tx.amount : 0;
                return total + Math.max(amount, 0);
            }, 0);
            if (data.spent !== spent) {
                await docSnapshot.ref.update({ spent });
            }
            const usage = spent / limit;
            let thresholdTriggered = null;
            if (usage >= 1) {
                thresholdTriggered = '100';
            }
            else if (usage >= 0.8) {
                thresholdTriggered = '80';
            }
            if (thresholdTriggered) {
                const eventKey = createBudgetNotificationKey(userId, normalizedCategory, periodStartISO, thresholdTriggered);
                const percentage = Math.round(usage * 100);
                const spentLabel = formatCurrency(spent);
                const limitLabel = formatCurrency(limit);
                const message = `${category} budget spent ${spentLabel} of ${limitLabel} (${percentage}%).`;
                const notificationType = thresholdTriggered === '100' ? 'budget-100' : 'budget-80';
                const pushTitle = thresholdTriggered === '100'
                    ? `${category} budget reached 100%`
                    : `${category} budget at 80%`;
                const pushSentRecently = await wasEventSentRecently(userId, eventKey, 'push');
                if (!pushSentRecently) {
                    const result = await sendPushToUser(userId, {
                        title: pushTitle,
                        body: message,
                        data: {
                            type: notificationType,
                            budgetId,
                            periodStart: periodStartISO,
                            threshold: thresholdTriggered,
                        },
                    }, { cache: tokenCache });
                    if (result.successCount + result.failureCount > 0) {
                        await logNotification({
                            userId,
                            type: notificationType,
                            message,
                            channel: 'push',
                            eventKey,
                        });
                        await rememberNotificationKey(userId, eventKey, 'push');
                    }
                }
                if (resendClient) {
                    const emailSentRecently = await wasEventSentRecently(userId, eventKey, 'email');
                    if (!emailSentRecently) {
                        const email = await lookupUserEmail(userId, emailCache);
                        if (email) {
                            await resendClient.emails.send({
                                from: 'Finance App <notifications@finance-app.dev>',
                                to: email,
                                subject: pushTitle,
                                html: `<h2>${pushTitle}</h2><p>${message}</p>`,
                            });
                            await logNotification({
                                userId,
                                type: notificationType,
                                message,
                                channel: 'email',
                                eventKey,
                            });
                            await rememberNotificationKey(userId, eventKey, 'email');
                        }
                    }
                }
            }
            results.push({
                budgetId,
                category,
                spent,
                limit,
                thresholdTriggered,
            });
        }
        catch (error) {
            results.push({
                budgetId: docSnapshot.id,
                category: docSnapshot.data().category ?? '',
                spent: 0,
                limit: 0,
                thresholdTriggered: null,
            });
            console.error('budgetEngine: failed to process budget', {
                budgetId: docSnapshot.id,
                error,
            });
        }
    }
    return results;
}
function resolvePeriodRange({ period, startDate, endDate, reference, }) {
    const normalizedPeriod = (period ?? '').toLowerCase();
    let start = null;
    let end = null;
    if (normalizedPeriod === 'weekly') {
        const current = new Date(reference);
        const day = current.getDay() || 7;
        start = new Date(current);
        start.setDate(current.getDate() - (day - 1));
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
    }
    else if (normalizedPeriod === 'monthly') {
        start = new Date(reference.getFullYear(), reference.getMonth(), 1);
        end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }
    else if (normalizedPeriod === 'quarterly') {
        const quarter = Math.floor(reference.getMonth() / 3);
        start = new Date(reference.getFullYear(), quarter * 3, 1);
        end = new Date(reference.getFullYear(), quarter * 3 + 3, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }
    else if (normalizedPeriod === 'yearly') {
        start = new Date(reference.getFullYear(), 0, 1);
        end = new Date(reference.getFullYear(), 12, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }
    else {
        start = parseDateValue(startDate);
        end = parseDateValue(endDate);
    }
    if (start) {
        start.setHours(0, 0, 0, 0);
    }
    if (end) {
        end.setHours(23, 59, 59, 999);
    }
    return {
        startDate: start,
        endDate: end,
        periodStartISO: start ? toISODate(start) : '',
    };
}
function parseDateValue(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value?.toDate === 'function') {
        return value.toDate();
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return null;
}
function toISODate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}
function sanitizeCategory(value) {
    return value.trim().toLowerCase();
}
function createBudgetNotificationKey(userId, category, periodStartISO, threshold) {
    return `budget#${userId}#${category}#${periodStartISO || 'custom'}#${threshold}`;
}
function formatCurrency(amount) {
    return currencyFormatter.format(amount);
}
