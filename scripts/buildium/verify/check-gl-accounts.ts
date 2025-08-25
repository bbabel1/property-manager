import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkGLAccounts() {
  const { data, error } = await supabase
    .from('gl_accounts')
    .select('*')
  
  if (error) {
    console.error('Error fetching GL accounts:', error)
    return
  }
  
  console.log('GL Accounts:')
  data?.forEach(account => {
    console.log(`ID: ${account.buildium_gl_account_id}, Name: ${account.name}, Type: ${account.type}, SubType: ${account.sub_type}`)
  })
}

checkGLAccounts()
