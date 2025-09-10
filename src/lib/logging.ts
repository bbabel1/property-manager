import type { NextRequest } from 'next/server'
import { logger } from './logger'

function extractTraceContext(req: NextRequest) {
  const traceparent = req.headers.get('traceparent') || undefined
  const tracestate = req.headers.get('tracestate') || undefined
  return { traceparent, tracestate }
}

export function createRequestLogger(req: NextRequest, name?: string) {
  const { pathname } = new URL(req.url)
  const requestId = req.headers.get('x-request-id') || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  const { traceparent, tracestate } = extractTraceContext(req)

  return logger.child({
    req: {
      id: requestId,
      method: req.method,
      path: pathname,
    },
    trace: { traceparent, tracestate },
    name,
  })
}

