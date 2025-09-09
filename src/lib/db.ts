import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Be tolerant in development: don't throw at import-time. Consumers should handle undefineds.
// Still, without these, the client cannot function, so log a clear warning.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Set them in .env.local.'
  )
}

// Client for frontend/client-side operations (safe to create even if values are undefined; calls will fail clearly)
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

// Admin client for server-side operations (API routes only). Optional if key missing.
const isServer = typeof window === 'undefined'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = isServer && serviceKey
  ? createClient(supabaseUrl || '', serviceKey)
  : undefined

export { supabaseAdmin }
export default supabaseAdmin
