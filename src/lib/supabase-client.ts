import { supabase, supabaseAdmin, supabaseAdminMaybe, type TypedSupabaseClient } from '@/lib/db'

export class SupabaseAdminUnavailableError extends Error {
  constructor(context?: string) {
    const suffix = context ? ` for ${context}` : ''
    super(
      `Supabase service-role client is not configured${suffix}. Set SUPABASE_SERVICE_ROLE_KEY to enable admin operations.`
    )
    this.name = 'SupabaseAdminUnavailableError'
  }
}

export class SupabaseClientUnavailableError extends Error {
  constructor(context?: string) {
    const suffix = context ? ` for ${context}` : ''
    super(
      `Supabase client is not available${suffix}. Check environment variables.`
    )
    this.name = 'SupabaseClientUnavailableError'
  }
}

/** Returns the shared browser-safe client (anon key) with proper error handling. */
export const getSupabaseClient = (context?: string): TypedSupabaseClient => {
  if (!supabase) {
    throw new SupabaseClientUnavailableError(context)
  }
  return supabase
}

/** Returns an always-defined server client, falling back to anon when service role is absent. */
export const getServerSupabaseClient = (context?: string): TypedSupabaseClient => {
  if (!supabaseAdminMaybe && !supabase) {
    throw new SupabaseClientUnavailableError(context)
  }
  return supabaseAdminMaybe ?? supabase
}

/**
 * Returns the service-role client or throws a typed error so callers can surface
 * a clear configuration issue instead of failing on `undefined`.
 */
export const requireSupabaseAdmin = (context?: string): TypedSupabaseClient => {
  if (!supabaseAdminMaybe) {
    throw new SupabaseAdminUnavailableError(context)
  }
  return supabaseAdmin
}

export const hasSupabaseAdmin = (): boolean => Boolean(supabaseAdminMaybe)

/**
 * Safely get Supabase client with fallback handling
 * @param requireAdmin - Whether to require admin client
 * @param context - Context for error messages
 * @returns Supabase client or throws error
 */
export const getSupabaseClientSafe = (
  requireAdmin: boolean = false,
  context?: string
): TypedSupabaseClient => {
  if (requireAdmin) {
    return requireSupabaseAdmin(context)
  }
  return getSupabaseClient(context)
}
