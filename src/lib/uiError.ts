const FALLBACK_MESSAGE = '發生問題，請稍後再試或重新整理'

const CODE_MESSAGES: Record<string, string> = {
  'permission-denied': '請先登入後再試',
  unavailable: '服務暫時不穩，稍後再試',
  'deadline-exceeded': '服務暫時不穩，稍後再試',
  'network-request-failed': '服務暫時不穩，稍後再試',
  'not-found': '資料不存在或已刪除',
}

function extractCode(error: unknown): string | null {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object') {
    const { code, message } = error as { code?: unknown; message?: unknown }
    if (typeof code === 'string') {
      return code
    }
    if (typeof message === 'string') {
      return message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return null
}

function normalizeCode(raw: string): string {
  if (raw.includes('/')) {
    const parts = raw.split('/')
    return parts[parts.length - 1] ?? raw
  }
  return raw
}

export function toUserMessage(error: unknown): string {
  const code = extractCode(error)
  if (!code) {
    return FALLBACK_MESSAGE
  }

  const normalized = normalizeCode(code)
  if (CODE_MESSAGES[normalized]) {
    return CODE_MESSAGES[normalized]
  }

  const matched = Object.keys(CODE_MESSAGES).find((key) => code.includes(key))
  if (matched) {
    return CODE_MESSAGES[matched]
  }

  return FALLBACK_MESSAGE
}

export default toUserMessage
