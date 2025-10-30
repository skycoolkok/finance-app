import { FX_ADMIN_EMAILS } from '../params'

export function isFxAdmin(email?: string): boolean {
  const allowList = readAdminEmailList()

  if (!email) {
    return false
  }

  const normalizedEmail = email.trim().toLowerCase()
  return allowList.includes(normalizedEmail)
}

function readAdminEmailList(): string[] {
  const fromSecret = readSecretList()
  if (fromSecret.length > 0) {
    return fromSecret
  }

  return (process.env.FX_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

function readSecretList(): string[] {
  try {
    const value = FX_ADMIN_EMAILS.value()
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
