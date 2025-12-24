import { logger } from "./logger"

let sentry: typeof import("@sentry/nextjs") | null = null
// Conditionally and lazily load Sentry using dynamic import to satisfy
// eslint rules and avoid bundling when DSN is not configured.
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs")
    .then((m) => {
      sentry = m
    })
    .catch(() => {
      sentry = null
    })
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  const e = err instanceof Error ? err : new Error(String(err))
  if (sentry) {
    sentry.captureException(e, { extra: context as Record<string, unknown> | undefined })
  }
  logger.error({ err: e, ...context }, e.message)
}

export function reportMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>
) {
  const logLevel: "info" | "warn" | "error" = level === "warning" ? "warn" : level
  if (sentry) {
    sentry.captureMessage(message, { level, extra: context as Record<string, unknown> | undefined })
  }
  logger[logLevel]({ msg: message, ...context })
}
