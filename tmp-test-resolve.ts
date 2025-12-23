import { resolveBankGlAccountId } from './src/lib/buildium-mappers'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '')
;(async () => {
  const res = await resolveBankGlAccountId(10407, supabase as any)
  console.log('result', res)
})();
