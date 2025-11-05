'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.sanitizeForKey = sanitizeForKey
function sanitizeForKey(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}
