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

// NOTE: many routes still rely on tables and functions that aren't captured in the
// generated Database types yet. We temporarily widen the table constraint to `any`
// so we can iterate on the schema while keeping typed row payloads. Once the schema
// metadata is regenerated, we can tighten this back to `keyof Database['public']['Tables']`.
export type TypedSupabaseClient = SupabaseClient<Database, 'public', any>

// Client for frontend/client-side operations (safe to create even if values are undefined; calls will fail clearly)
export const supabase: TypedSupabaseClient = createClient<Database>(supabaseUrl || '', supabaseAnonKey || '')

// Admin client for server-side operations (API routes only). Optional if key missing.
const isServer = typeof window === 'undefined'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdminInternal = isServer && serviceKey
  ? createClient<Database>(supabaseUrl || '', serviceKey)
  : undefined

export const supabaseAdminMaybe = supabaseAdminInternal
export const supabaseAdmin: TypedSupabaseClient = supabaseAdminInternal ?? supabase

export default supabase
