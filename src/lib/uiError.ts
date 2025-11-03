const FALLBACK_MESSAGE = '發生問題，請稍後再試或重新整理'

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

  return null
}

export function toUserMessage(error: unknown): string {
  const code = extractCode(error)
  if (!code) {
    return FALLBACK_MESSAGE
  }

  if (code.includes('permission-denied')) {
    return '請先登入後再試'
  }

  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('network-request-failed')
  ) {
    return '服務暫時不穩，稍後再試'
  }

  if (code.includes('not-found')) {
    return '資料不存在或已刪除'
  }

  return FALLBACK_MESSAGE
}

export default toUserMessage
