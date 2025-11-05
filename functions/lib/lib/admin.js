'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.isFxAdmin = isFxAdmin
const params_1 = require('../params')
function isFxAdmin(email) {
  const allowList = readAdminEmailList()
  if (!email) {
    return false
  }
  const normalizedEmail = email.trim().toLowerCase()
  return allowList.includes(normalizedEmail)
}
function readAdminEmailList() {
  const fromSecret = readSecretList()
  if (fromSecret.length > 0) {
    return fromSecret
  }
  return (process.env.FX_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}
function readSecretList() {
  try {
    const value = params_1.FX_ADMIN_EMAILS.value()
    if (!value) {
      return []
    }
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  } catch {
    return []
  }
}
