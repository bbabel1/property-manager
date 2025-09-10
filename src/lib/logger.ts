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

export const logger = pino({
  level,
  base,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: true, singleLine: true },
      }
    : undefined,
})

export type Logger = typeof logger
