import { build } from 'vite'

function resolveBuildId() {
  const envBuildId = process.env.VITE_BUILD_ID
  if (envBuildId && typeof envBuildId === 'string' && envBuildId.trim()) {
    return envBuildId.trim()
  }

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (commitSha && typeof commitSha === 'string' && commitSha.length >= 7) {
    return commitSha.slice(0, 7)
  }

  return 'local'
}

async function main() {
  const buildId = resolveBuildId()
  process.env.VITE_BUILD_ID = buildId

  if (process.env.NODE_ENV === undefined) {
    process.env.NODE_ENV = 'production'
  }

  console.log(`[build] Using BuildId: ${buildId}`)

  try {
    await build()
    console.log('[build] Vite build completed')
  } catch (error) {
    console.error('[build] Vite build failed', error)
    process.exitCode = 1
  }
}

await main()
