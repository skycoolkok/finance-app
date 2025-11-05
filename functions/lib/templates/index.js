'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.getTemplates = getTemplates
exports.resolveLocaleTag = resolveLocaleTag
const notification_1 = __importDefault(require('./en/notification'))
const notification_2 = __importDefault(require('./zh-TW/notification'))
const TEMPLATE_REGISTRY = new Map([
  ['en', notification_1.default],
  ['en-US', notification_1.default],
  ['en-GB', notification_1.default],
  ['zh-TW', notification_2.default],
  ['zh', notification_2.default],
  ['zh-Hant', notification_2.default],
])
function getTemplates(locale) {
  const normalized = resolveLocaleTag(locale)
  return TEMPLATE_REGISTRY.get(normalized) ?? notification_1.default
}
function resolveLocaleTag(locale) {
  if (!locale) {
    return 'en'
  }
  const trimmed = locale.trim()
  if (!trimmed) {
    return 'en'
  }
  const lower = trimmed.toLowerCase()
  for (const key of TEMPLATE_REGISTRY.keys()) {
    if (key.toLowerCase() === lower) {
      return key
    }
  }
  const prefix = lower.split(/[-_]/)[0]
  for (const key of TEMPLATE_REGISTRY.keys()) {
    if (key.toLowerCase().startsWith(prefix)) {
      return key
    }
  }
  return 'en'
}
