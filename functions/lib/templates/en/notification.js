"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CURRENCY = 'USD';
const templates = {
    dueReminder: input => {
        const url = resolveUrl(input.baseUrl, '/cards');
        const amount = formatCurrency(input.amount);
        const dueDate = formatDate(input.dueDate);
        const summary = formatDueSummary(input, amount, dueDate);
        const subject = 'Card payment reminder';
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
                        `Card: ${input.cardLabel}`,
                        `Due date: ${dueDate}`,
                        `Balance: ${amount}`,
                    ],
                    ctaText: 'Review card activity',
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
        const subject = isCritical ? 'High utilization alert' : 'Utilization warning';
        const summary = `${input.cardLabel} is at ${percent}% of its credit limit (balance ${amount} of ${limit}).`;
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
                        `Card: ${input.cardLabel}`,
                        `Current balance: ${amount}`,
                        `Credit limit: ${limit}`,
                    ],
                    ctaText: 'Open cards dashboard',
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
        const subject = input.percentage >= 1
            ? 'Budget exceeded'
            : `Budget reached ${Math.max(percent, input.threshold)}%`;
        const summary = input.percentage >= 1
            ? `${input.budgetLabel} exceeded its budget (spent ${spent} of ${limit}).`
            : `${input.budgetLabel} is at ${percent}% of its budget (spent ${spent} of ${limit}).`;
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
                        `Budget: ${input.budgetLabel}`,
                        `Spent: ${spent}`,
                        `Limit: ${limit}`,
                    ],
                    ctaText: 'Review budget details',
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
        return `${input.cardLabel} payment was due on ${dueDate}. Outstanding balance: ${amount}.`;
    }
    if (input.daysToDue === 0) {
        return `${input.cardLabel} payment is due today (${dueDate}). Balance: ${amount}.`;
    }
    if (input.daysToDue === 1) {
        return `${input.cardLabel} payment is due tomorrow (${dueDate}). Balance: ${amount}.`;
    }
    return `${input.cardLabel} payment is due in ${input.daysToDue} days on ${dueDate}. Balance: ${amount}.`;
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: CURRENCY,
        maximumFractionDigits: 2,
    }).format(amount);
}
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date);
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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(options.heading)}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #0f172a; background-color: #f8fafc; padding: 24px;">
    <table role="presentation" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
      <tr>
        <td>
          <h1 style="font-size: 20px; margin-bottom: 12px;">${escapeHtml(options.heading)}</h1>
          <p style="font-size: 14px; line-height: 1.5; margin-bottom: 16px;">${escapeHtml(options.intro)}</p>
          <ul style="padding-left: 20px; margin-bottom: 20px; font-size: 14px; color: #1e293b;">
            ${factsList}
          </ul>
          <p style="margin: 0;">
            <a href="${options.url}" style="display: inline-block; padding: 10px 16px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
              ${escapeHtml(options.ctaText)}
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">You are receiving this reminder because it was enabled in Finance App.</p>
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
