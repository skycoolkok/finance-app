import { config as functionsConfig } from 'firebase-functions'

export function isFxAdmin(email?: string): boolean {
  let configuredList = ''
  try {
    configuredList = functionsConfig().app?.fx_admin_emails ?? ''
  } catch {
    configuredList = ''
  }

  const raw = process.env.FX_ADMIN_EMAILS ?? configuredList ?? ''

  if (!email) {
    return false
  }

  const normalizedEmail = email.trim().toLowerCase()
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail)
}
