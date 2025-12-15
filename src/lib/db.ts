import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Be tolerant in development: don't throw at import-time. Consumers should handle undefineds.
// Still, without these, the client cannot function, so log a clear warning.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Set them in .env.local.'
  )
}

export type TypedSupabaseClient = SupabaseClient<any>

// Client for frontend/client-side operations (safe to create even if values are undefined; calls will fail clearly)
export const supabase: TypedSupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Admin client for server-side operations (API routes only). Optional if key missing.
const isServer = typeof window === 'undefined'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdminInternal = isServer && serviceKey
  ? createClient(supabaseUrl || '', serviceKey)
  : undefined

if (isServer && !serviceKey) {
  console.warn(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY is not configured. Server-side data loaders that rely on the service role client will fail.'
  )
}

export const supabaseAdminMaybe = supabaseAdminInternal
export const supabaseAdmin: TypedSupabaseClient = supabaseAdminInternal ?? supabase

export class SupabaseServiceRoleMissingError extends Error {
  constructor(context?: string) {
    const suffix = context ? ` while ${context}` : ''
    super(
      `Supabase service role key is not configured${suffix}. Set SUPABASE_SERVICE_ROLE_KEY in your environment to enable server-side data access.`
    )
    this.name = 'SupabaseServiceRoleMissingError'
  }
}

export function getSupabaseServiceRoleClient(context?: string): TypedSupabaseClient {
  if (!supabaseAdminInternal) {
    throw new SupabaseServiceRoleMissingError(context)
  }
  return supabaseAdminInternal
}

export default supabase
