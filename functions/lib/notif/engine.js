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
exports.NotificationEngine = void 0;
exports.fetchUserLocale = fetchUserLocale;
exports.logNotificationRecord = logNotificationRecord;
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const templates_1 = require("../templates");
const renderer_1 = require("../templates/renderer");
const clickRedirect_1 = require("../tracking/clickRedirect");
const openPixel_1 = require("../tracking/openPixel");
const abtest_1 = require("./abtest");
const utils_1 = require("./utils");
class NotificationEngine {
    constructor(options) {
        this.tokenCache = new Map();
        this.emailCache = new Map();
        this.localeCache = new Map();
        this.firestore = options.firestore;
        this.messaging = options.messaging;
        this.resendClient = options.resendClient;
        this.notificationWindowMs = options.notificationWindowMs;
        this.baseUrl = options.baseUrl;
        this.logger = options.logger ?? firebase_functions_1.logger;
    }
    async deliverReminder(reminder) {
        const locale = await fetchUserLocale({
            firestore: this.firestore,
            userId: reminder.userId,
            cache: this.localeCache,
        });
        const templates = (0, templates_1.getTemplates)(locale);
        const content = this.renderContent(templates, reminder.template);
        const abVariant = (0, abtest_1.assignVariant)({ userId: reminder.userId, eventKey: reminder.eventKey });
        await this.deliverPush(reminder, content, locale, abVariant);
        await this.deliverEmail(reminder, content, locale, abVariant);
    }
    async log(record) {
        return logNotificationRecord(this.firestore, record);
    }
    async resolveLocale(userId) {
        return fetchUserLocale({
            firestore: this.firestore,
            userId,
            cache: this.localeCache,
        });
    }
    renderContent(templates, template) {
        switch (template.kind) {
            case 'due':
                return templates.dueReminder({
                    ...template.data,
                    baseUrl: this.baseUrl,
                });
            case 'utilization':
                return templates.utilizationAlert({
                    ...template.data,
                    baseUrl: this.baseUrl,
                });
            case 'budget':
                return templates.budgetAlert({
                    ...template.data,
                    baseUrl: this.baseUrl,
                });
            default: {
                const exhaustive = template;
                throw new Error(`Unsupported template kind: ${JSON.stringify(exhaustive)}`);
            }
        }
    }
    async deliverPush(reminder, content, locale, abVariant) {
        const shouldSend = !(await this.wasEventSentRecently(reminder, 'push'));
        if (!shouldSend) {
            return;
        }
        const tokens = await this.fetchUserTokens(reminder.userId);
        if (tokens.length === 0) {
            return;
        }
        await this.messaging.sendEachForMulticast({
            tokens,
            notification: {
                title: content.push.title,
                body: content.push.body,
            },
            data: this.composeDataPayload(reminder, locale, content.url, abVariant),
        });
        await this.log({
            userId: reminder.userId,
            type: reminder.type,
            message: content.summary,
            channel: 'push',
            eventKey: reminder.eventKey,
            locale,
            cardId: reminder.cardId,
            budgetId: reminder.budgetId,
            abVariant,
        });
        await this.rememberNotificationKey(reminder, 'push');
    }
    async deliverEmail(reminder, content, locale, abVariant) {
        if (!this.resendClient) {
            return;
        }
        const shouldSend = !(await this.wasEventSentRecently(reminder, 'email'));
        if (!shouldSend) {
            return;
        }
        const email = await this.lookupUserEmail(reminder.userId);
        if (!email) {
            return;
        }
        const nid = this.firestore.collection('notifications').doc().id;
        const resolvedLocale = (0, templates_1.resolveLocaleTag)(locale);
        const baseOpenPixelUrl = (0, openPixel_1.resolveOpenPixelUrl)();
        const baseClickRedirectUrl = (0, clickRedirect_1.resolveClickRedirectUrl)(this.baseUrl);
        const openUrl = baseOpenPixelUrl
            ? this.appendTrackingParams(baseOpenPixelUrl, {
                nid,
                uid: reminder.userId,
                variant: abVariant,
                event: reminder.eventKey,
                channel: 'email',
            })
            : undefined;
        const clickUrl = this.appendTrackingParams(baseClickRedirectUrl, {
            nid,
            uid: reminder.userId,
            variant: abVariant,
            event: reminder.eventKey,
            channel: 'email',
            url: content.url,
        });
        const emailContext = {
            ...content.email.context,
            clickUrl,
            ...(openUrl ? { openUrl } : {}),
            ctaUrl: content.email.context?.ctaUrl ?? content.url,
            preferencesUrl: content.email.context?.preferencesUrl ??
                this.appendPath(this.baseUrl, '/settings/notifications'),
            logoUrl: content.email.context?.logoUrl ??
                this.appendPath(this.baseUrl, '/icons/icon-192.png'),
        };
        let html;
        try {
            html = await (0, renderer_1.renderEmailTemplate)({
                locale: resolvedLocale,
                variant: abVariant,
                templateName: content.email.templateName,
                context: emailContext,
            });
        }
        catch (error) {
            this.logger.error('Failed to render email template', {
                error,
                locale: resolvedLocale,
                userId: reminder.userId,
                templateName: content.email.templateName,
                variant: abVariant,
            });
            return;
        }
        try {
            await this.resendClient.emails.send({
                from: 'Finance App <notifications@finance-app.dev>',
                to: email,
                subject: content.email.subject,
                html,
                text: content.summary,
            });
        }
        catch (error) {
            this.logger.error('Failed to send email notification', {
                error,
                userId: reminder.userId,
                eventKey: reminder.eventKey,
            });
            return;
        }
        await this.log({
            userId: reminder.userId,
            type: reminder.type,
            message: content.summary,
            channel: 'email',
            eventKey: reminder.eventKey,
            locale,
            cardId: reminder.cardId,
            budgetId: reminder.budgetId,
            abVariant,
            nid,
            tracking: {
                ...(openUrl ? { openUrl } : {}),
                clickUrl,
            },
        });
        await this.rememberNotificationKey(reminder, 'email');
    }
    appendTrackingParams(base, params) {
        const candidates = [base, this.appendPath(this.baseUrl, base)];
        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }
            try {
                const url = new URL(candidate);
                for (const [key, value] of Object.entries(params)) {
                    if (value === undefined || value === null) {
                        continue;
                    }
                    url.searchParams.set(key, String(value));
                }
                return url.toString();
            }
            catch {
                continue;
            }
        }
        return base;
    }
    appendPath(base, path) {
        try {
            return new URL(path, this.ensureTrailingSlash(base)).toString();
        }
        catch {
            return base;
        }
    }
    ensureTrailingSlash(value) {
        return value.endsWith('/') ? value : `${value}/`;
    }
    composeDataPayload(reminder, locale, url, abVariant) {
        const data = {
            type: reminder.type,
            eventKey: reminder.eventKey,
            locale: (0, templates_1.resolveLocaleTag)(locale),
            url,
            variant: abVariant,
        };
        if (reminder.cardId) {
            data.cardId = reminder.cardId;
        }
        if (reminder.budgetId) {
            data.budgetId = reminder.budgetId;
        }
        return data;
    }
    async fetchUserTokens(userId) {
        if (this.tokenCache.has(userId)) {
            return this.tokenCache.get(userId) ?? [];
        }
        const snapshot = await this.firestore
            .collection('user_tokens')
            .where('userId', '==', userId)
            .get();
        const tokens = snapshot.docs
            .map((docSnapshot) => docSnapshot.data().token)
            .filter((token) => typeof token === 'string' && token.length > 0);
        this.tokenCache.set(userId, tokens);
        return tokens;
    }
    async lookupUserEmail(userId) {
        if (this.emailCache.has(userId)) {
            return this.emailCache.get(userId) ?? null;
        }
        const userRecord = await admin
            .auth()
            .getUser(userId)
            .catch(() => null);
        const email = userRecord?.email ?? null;
        this.emailCache.set(userId, email);
        return email;
    }
    async wasEventSentRecently(reminder, channel) {
        const docRef = this.notificationKeyRef(reminder.userId, reminder.eventKey, channel);
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            return false;
        }
        const sentAt = snapshot.get('sentAt');
        if (!sentAt) {
            return false;
        }
        return sentAt.toMillis() >= Date.now() - this.notificationWindowMs;
    }
    async rememberNotificationKey(reminder, channel) {
        const docRef = this.notificationKeyRef(reminder.userId, reminder.eventKey, channel);
        await docRef.set({
            userId: reminder.userId,
            eventKey: reminder.eventKey,
            channel,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    notificationKeyRef(userId, eventKey, channel) {
        const docId = (0, utils_1.sanitizeForKey)(`${userId}:${channel}:${eventKey}`);
        return this.firestore.collection('notif_keys').doc(docId);
    }
}
exports.NotificationEngine = NotificationEngine;
async function fetchUserLocale({ firestore, userId, cache, }) {
    if (cache?.has(userId)) {
        return cache.get(userId) ?? 'en';
    }
    const snapshot = await firestore.collection('users').doc(userId).get();
    const docLocale = snapshot.exists ? snapshot.get('locale') : undefined;
    const locale = typeof docLocale === 'string' && docLocale.trim().length > 0 ? docLocale.trim() : 'en';
    cache?.set(userId, locale);
    return locale;
}
async function logNotificationRecord(firestore, record) {
    const collection = firestore.collection('notifications');
    const docRef = record.nid ? collection.doc(record.nid) : collection.doc();
    const payload = {
        userId: record.userId,
        type: record.type,
        message: record.message,
        channel: record.channel,
        eventKey: record.eventKey,
        locale: (0, templates_1.resolveLocaleTag)(record.locale),
        cardId: record.cardId ?? null,
        budgetId: record.budgetId ?? null,
        nid: docRef.id,
        abVariant: record.abVariant ?? null,
        read: false,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (record.metadata) {
        payload.metadata = record.metadata;
    }
    if (record.tracking) {
        payload.tracking = record.tracking;
    }
    await docRef.set(payload, { merge: true });
    return docRef.id;
}
