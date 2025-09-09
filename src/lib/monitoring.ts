import { logger } from "./logger"

let sentry: typeof import("@sentry/nextjs") | null = null
try {
  // Dynamic import so apps without DSN don’t incur Sentry bundle
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require("@sentry/nextjs")
  }
} catch {
  sentry = null
}

export function reportError(err: unknown, context?: Record<string, any>) {
  const e = err instanceof Error ? err : new Error(String(err))
  if (sentry) {
    sentry.captureException(e, { extra: context })
  }
  logger.error({ err: e, ...context }, e.message)
}

export function reportMessage(message: string, level: "info" | "warning" | "error" = "info", context?: Record<string, any>) {
  if (sentry) {
    sentry.captureMessage(message, { level, extra: context })
  }
  logger[level]({ msg: message, ...context })
}

