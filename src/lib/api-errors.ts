import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export type ApiFieldError = {
  field: string
  message: string
  code?: string
}

export type ApiErrorResponse = {
  code: string
  message: string
  fieldErrors?: ApiFieldError[]
  details?: unknown
  correlationId?: string | null
}

function build(body: ApiErrorResponse, status: number, headers?: Record<string, string>) {
  const res = NextResponse.json(body, { status })
  if (headers) {
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
  }
  return res
}

export function validationError(err: ZodError, correlationId?: string | null) {
  const fieldErrors: ApiFieldError[] = err.issues.map(e => ({
    field: e.path.join('.') || 'root',
    message: e.message,
  }))
  return build({ code: 'VALIDATION_ERROR', message: 'Validation failed', fieldErrors, correlationId: correlationId ?? null }, 422)
}

export function badRequest(message: string, opts?: { fieldErrors?: ApiFieldError[]; details?: unknown; correlationId?: string | null }) {
  return build({ code: 'BAD_REQUEST', message, fieldErrors: opts?.fieldErrors, details: opts?.details, correlationId: opts?.correlationId ?? null }, 400)
}

export function unauthorized(message = 'Authentication required', correlationId?: string | null) {
  return build({ code: 'UNAUTHORIZED', message, correlationId: correlationId ?? null }, 401)
}

export function forbidden(message = 'Not allowed', correlationId?: string | null) {
  return build({ code: 'FORBIDDEN', message, correlationId: correlationId ?? null }, 403)
}

export function notFound(message = 'Not found', correlationId?: string | null) {
  return build({ code: 'NOT_FOUND', message, correlationId: correlationId ?? null }, 404)
}

export function conflict(message = 'Conflict', opts?: { details?: unknown; correlationId?: string | null }) {
  return build({ code: 'CONFLICT', message, details: opts?.details, correlationId: opts?.correlationId ?? null }, 409)
}

export function tooManyRequests(message = 'Rate limited', retryAfterSeconds?: number, correlationId?: string | null) {
  const headers: Record<string, string> = {}
  if (retryAfterSeconds !== undefined) headers['Retry-After'] = String(retryAfterSeconds)
  return build({ code: 'RATE_LIMITED', message, correlationId: correlationId ?? null }, 429, headers)
}

export function serverError(message = 'Internal server error', details?: unknown, correlationId?: string | null) {
  return build({ code: 'INTERNAL_ERROR', message, details, correlationId: correlationId ?? null }, 500)
}
