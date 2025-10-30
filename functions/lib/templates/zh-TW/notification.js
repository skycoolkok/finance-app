"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CURRENCY = 'TWD';
const templates = {
    dueReminder: (input) => {
        const url = resolveUrl(input.baseUrl, '/cards');
        const amount = formatCurrency(input.amount);
        const dueDate = formatDate(input.dueDate);
        const summary = formatDueSummary(input, amount, dueDate);
        const subject = '信用卡繳款提醒';
        return buildNotification({
            subject,
            summary,
            url,
            facts: [`卡片：${input.cardLabel}`, `繳款日：${dueDate}`, `待繳金額：${amount}`],
            ctaText: '查看卡片明細',
            baseUrl: input.baseUrl,
        });
    },
    utilizationAlert: (input) => {
        const url = resolveUrl(input.baseUrl, '/cards');
        const percent = Math.round(input.utilization * 100);
        const limit = formatCurrency(input.limit);
        const amount = formatCurrency(input.amount);
        const isCritical = input.threshold >= 95;
        const subject = isCritical ? '信用卡額度過高警示' : '信用卡額度提醒';
        const summary = `${input.cardLabel} 已使用 ${percent}% 額度（目前餘額 ${amount}／總額度 ${limit}）。`;
        return buildNotification({
            subject,
            summary,
            url,
            facts: [`卡片：${input.cardLabel}`, `目前餘額：${amount}`, `總額度：${limit}`],
            ctaText: '前往卡片總覽',
            baseUrl: input.baseUrl,
        });
    },
    budgetAlert: (input) => {
        const url = resolveUrl(input.baseUrl, '/budgets');
        const spent = formatCurrency(input.spent);
        const limit = formatCurrency(input.limit);
        const percent = Math.round(input.percentage * 100);
        const subject = input.percentage >= 1 ? '預算已超出' : `預算已達 ${Math.max(percent, input.threshold)}%`;
        const summary = input.percentage >= 1
            ? `${input.budgetLabel} 已超出預算（累計 ${spent}／預算 ${limit}）。`
            : `${input.budgetLabel} 已使用預算 ${percent}%（累計 ${spent}／預算 ${limit}）。`;
        return buildNotification({
            subject,
            summary,
            url,
            facts: [`預算：${input.budgetLabel}`, `已使用：${spent}`, `預算上限：${limit}`],
            ctaText: '檢視預算詳情',
            baseUrl: input.baseUrl,
        });
    },
};
exports.default = templates;
function formatDueSummary(input, amount, dueDate) {
    if (input.daysToDue < 0) {
        return `${input.cardLabel} 已於 ${dueDate} 到期，尚有未繳金額 ${amount}。`;
    }
    if (input.daysToDue === 0) {
        return `今日（${dueDate}）為 ${input.cardLabel} 繳款日，請記得繳納 ${amount}。`;
    }
    if (input.daysToDue === 1) {
        return `明日（${dueDate}）為 ${input.cardLabel} 繳款日，應繳金額 ${amount}。`;
    }
    return `${input.cardLabel} 還有 ${input.daysToDue} 天到繳款日（${dueDate}），應繳金額 ${amount}。`;
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 2,
    }).format(amount);
}
function formatDate(date) {
    return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'long' }).format(date);
}
function resolveUrl(baseUrl, path) {
    try {
        return new URL(path, ensureTrailingSlash(baseUrl)).toString();
    }
    catch {
        return path;
    }
}
function ensureTrailingSlash(baseUrl) {
    if (!baseUrl.endsWith('/')) {
        return `${baseUrl}/`;
    }
    return baseUrl;
}
function buildNotification(options) {
    const preferencesUrl = resolveUrl(options.baseUrl, '/settings/notifications');
    const logoUrl = resolveUrl(options.baseUrl, '/icons/icon-192.png');
    return {
        summary: options.summary,
        push: {
            title: options.subject,
            body: options.summary,
        },
        email: {
            subject: options.subject,
            templateName: 'email',
            context: {
                heading: options.subject,
                intro: options.summary,
                facts: options.facts,
                ctaText: options.ctaText,
                ctaUrl: options.url,
                preferencesUrl,
                logoUrl,
            },
        },
        url: options.url,
    };
}
