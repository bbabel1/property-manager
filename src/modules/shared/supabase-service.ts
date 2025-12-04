import type { ZodSchema } from 'zod'

import { getSupabaseServiceRoleClient, type TypedSupabaseClient } from '@/lib/db'

export type DomainServiceClient = TypedSupabaseClient

// Creates a domain-scoped Supabase client getter with a readable context for error messages.
export const createServiceClientGetter = (domain: string) => () =>
  getSupabaseServiceRoleClient(`${domain} service`)

// Validate a payload with a Zod schema and throw with a readable message on failure.
export function validateWithSchema<T>(schema: ZodSchema<T>, payload: unknown, context = 'payload'): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Invalid ${context}: ${issues}`)
  }
  return result.data
}

// Ensure a value exists; useful for Supabase single-row expectations.
export function ensureFound<T>(value: T | null | undefined, message = 'Not found'): T {
  if (value == null) {
    throw new Error(message)
  }
  return value
}
