import { resolveBankGlAccountId } from './src/lib/buildium-mappers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './src/types/database'
import { config } from 'dotenv'
config({ path: '.env' })
const supabase: SupabaseClient<Database> = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)
;(async () => {
  const res = await resolveBankGlAccountId(10407, supabase)
  console.log('result', res)
})();
