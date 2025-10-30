"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderEmailTemplate = renderEmailTemplate;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const handlebars_1 = __importDefault(require("handlebars"));
const mjml_1 = __importDefault(require("mjml"));
const TEMPLATE_CACHE = new Map();
async function renderEmailTemplate(options) {
    const locale = normaliseLocale(options.locale);
    const variant = options.variant ?? 'A';
    const templateName = options.templateName ?? 'email';
    const candidateFiles = buildCandidateList(locale, templateName, variant);
    for (const candidate of candidateFiles) {
        const cached = TEMPLATE_CACHE.get(candidate.cacheKey);
        if (cached) {
            return renderFromCache(cached, options.context);
        }
        const template = await tryLoadTemplate(candidate.filePath);
        if (!template) {
            continue;
        }
        const compile = handlebars_1.default.compile(template, { noEscape: false });
        const type = candidate.extension === '.mjml' ? 'mjml' : 'hbs';
        const entry = { type, compile };
        TEMPLATE_CACHE.set(candidate.cacheKey, entry);
        return renderFromCache(entry, options.context);
    }
    throw new Error(`Email template not found for locale "${locale}" (variant ${variant}, template ${templateName}).`);
}
function renderFromCache(entry, context) {
    const templated = entry.compile(context);
    if (entry.type === 'mjml') {
        const result = (0, mjml_1.default)(templated, {
            minify: true,
            validationLevel: 'soft',
        });
        if (result.errors?.length) {
            throw new Error(`MJML render failed: ${result.errors.map((error) => error.formattedMessage).join('; ')}`);
        }
        return result.html;
    }
    return templated;
}
function buildCandidateList(locale, template, variant) {
    const filenames = [];
    const basePaths = [
        node_path_1.default.join(getTemplatesRoot(), locale),
        node_path_1.default.resolve(__dirname, '..', '..', 'src', 'templates', locale),
        node_path_1.default.join(process.cwd(), 'functions', 'src', 'templates', locale),
        node_path_1.default.join(process.cwd(), 'src', 'templates', locale),
    ];
    const uniquePaths = Array.from(new Set(basePaths));
    const orderedBasenames = [
        `${template}_${variant}.mjml`,
        `${template}_${variant}.hbs`,
        `${template}.mjml`,
        `${template}.hbs`,
    ];
    for (const base of uniquePaths) {
        for (const name of orderedBasenames) {
            const filePath = node_path_1.default.join(base, name);
            filenames.push({
                cacheKey: `${filePath}`,
                filePath,
                extension: name.endsWith('.mjml') ? '.mjml' : '.hbs',
            });
        }
    }
    return filenames;
}
async function tryLoadTemplate(filePath) {
    try {
        return await (0, promises_1.readFile)(filePath, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
function getTemplatesRoot() {
    return node_path_1.default.resolve(__dirname, '.');
}
function normaliseLocale(value) {
    const lower = value?.toLowerCase?.() ?? '';
    if (lower === 'zh-tw' || lower === 'zh_tw' || lower === 'zh-hant' || lower.startsWith('zh')) {
        return 'zh-TW';
    }
    return 'en';
}
