import pino from 'pino'

// Centralized base logger
// - JSON logs in production for ingestion by platforms (stdout)
// - Pretty-printed logs in development for readability

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
const base = {
  env: process.env.NODE_ENV,
  service: process.env.OTEL_SERVICE_NAME || 'property-manager',
  version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || undefined,
}

const isDev = process.env.NODE_ENV !== 'production'

// Pretty logging via pino-pretty uses a worker thread transport (thread-stream).
// In serverless/edge runtimes (including Next.js API route workers), that worker
// may not be bundled/available, causing runtime errors like:
//   Cannot find module '/ROOT/node_modules/thread-stream/lib/worker.js'
// To avoid crashing APIs, default to plain JSON logs unless explicitly enabled.
function shouldUsePretty(): boolean {
  if (!isDev) return false
  // Allow opt-in via env
  if (process.env.PRETTY_LOGS !== '1') return false
  // Avoid edge/serverless workers
  const isEdge = process.env.NEXT_RUNTIME === 'edge'
  const isVercel = process.env.VERCEL === '1'
  const isLambda = !!process.env.LAMBDA_TASK_ROOT
  // Next dev/server may set these private flags for workers
  const nextWorker = process.env.NEXT_PRIVATE_WORKER === 'true' || process.env.NEXT_WORKER === 'true'
  if (isEdge || isVercel || isLambda || nextWorker) return false
  // TTY check helps local terminals only
  try { return !!(process.stdout as any)?.isTTY } catch { return false }
}

export const logger = pino({
  level,
  base,
  transport: shouldUsePretty()
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: true, singleLine: true },
      }
    : undefined,
})

export type Logger = typeof logger
