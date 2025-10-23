"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CURRENCY = 'TWD';
const templates = {
    dueReminder: input => {
        const url = resolveUrl(input.baseUrl, '/cards');
        const amount = formatCurrency(input.amount);
        const dueDate = formatDate(input.dueDate);
        const summary = formatDueSummary(input, amount, dueDate);
        const subject = '信用卡繳款提醒';
        return {
            summary,
            push: {
                title: subject,
                body: summary,
            },
            email: {
                subject,
                html: renderEmail({
                    heading: subject,
                    intro: summary,
                    facts: [
                        `卡片：${input.cardLabel}`,
                        `繳款日：${dueDate}`,
                        `應繳金額：${amount}`,
                    ],
                    ctaText: '檢視卡片明細',
                    url,
                }),
            },
            url,
        };
    },
    utilizationAlert: input => {
        const url = resolveUrl(input.baseUrl, '/cards');
        const percent = Math.round(input.utilization * 100);
        const limit = formatCurrency(input.limit);
        const amount = formatCurrency(input.amount);
        const isCritical = input.threshold >= 95;
        const subject = isCritical ? '信用卡額度過高' : '信用卡額度提醒';
        const summary = `${input.cardLabel} 已使用額度 ${percent}%（目前餘額 ${amount}／總額度 ${limit}）。`;
        return {
            summary,
            push: {
                title: subject,
                body: summary,
            },
            email: {
                subject,
                html: renderEmail({
                    heading: subject,
                    intro: summary,
                    facts: [
                        `卡片：${input.cardLabel}`,
                        `目前餘額：${amount}`,
                        `總額度：${limit}`,
                    ],
                    ctaText: '前往卡片總覽',
                    url,
                }),
            },
            url,
        };
    },
    budgetAlert: input => {
        const url = resolveUrl(input.baseUrl, '/budgets');
        const spent = formatCurrency(input.spent);
        const limit = formatCurrency(input.limit);
        const percent = Math.round(input.percentage * 100);
        const subject = input.percentage >= 1 ? '預算已超出' : `預算達到 ${Math.max(percent, input.threshold)}%`;
        const summary = input.percentage >= 1
            ? `${input.budgetLabel} 已超出預算（累計 ${spent}／預算 ${limit}）。`
            : `${input.budgetLabel} 已使用預算 ${percent}%（累計 ${spent}／預算 ${limit}）。`;
        return {
            summary,
            push: {
                title: subject,
                body: summary,
            },
            email: {
                subject,
                html: renderEmail({
                    heading: subject,
                    intro: summary,
                    facts: [
                        `預算：${input.budgetLabel}`,
                        `已用金額：${spent}`,
                        `預算上限：${limit}`,
                    ],
                    ctaText: '檢視預算詳情',
                    url,
                }),
            },
            url,
        };
    },
};
exports.default = templates;
function formatDueSummary(input, amount, dueDate) {
    if (input.daysToDue < 0) {
        return `${input.cardLabel} 已於 ${dueDate} 到期，未清餘額 ${amount}。`;
    }
    if (input.daysToDue === 0) {
        return `今日（${dueDate}）為 ${input.cardLabel} 繳款日，應繳金額 ${amount}。`;
    }
    if (input.daysToDue === 1) {
        return `明日（${dueDate}）為 ${input.cardLabel} 繳款日，應繳金額 ${amount}。`;
    }
    return `${input.cardLabel} 尚有 ${input.daysToDue} 天到繳款日（${dueDate}），應繳金額 ${amount}。`;
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
function renderEmail(options) {
    const factsList = options.facts
        .map(item => `<li style="margin-bottom:4px">${escapeHtml(item)}</li>`)
        .join('');
    return `<!DOCTYPE html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(options.heading)}</title>
  </head>
  <body style="font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif; color: #0f172a; background-color: #f8fafc; padding: 24px;">
    <table role="presentation" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
      <tr>
        <td>
          <h1 style="font-size: 20px; margin-bottom: 12px;">${escapeHtml(options.heading)}</h1>
          <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">${escapeHtml(options.intro)}</p>
          <ul style="padding-left: 20px; margin-bottom: 20px; font-size: 14px; color: #1e293b;">
            ${factsList}
          </ul>
          <p style="margin: 0;">
            <a href="${options.url}" style="display: inline-block; padding: 10px 16px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
              ${escapeHtml(options.ctaText)}
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">此提醒由 Finance App 發送，與您在應用程式中的通知設定一致。</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
