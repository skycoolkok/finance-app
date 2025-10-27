export const version = {
  buildId: import.meta.env.VITE_BUILD_ID || 'dev',
} as const

export const buildId = version.buildId
