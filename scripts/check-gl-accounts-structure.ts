import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkGLAccounts() {
  console.log('🔍 Checking GL accounts structure...\n')

  // Get all GL accounts
  const { data: allGLs, error } = await supabase
    .from('gl_accounts')
    .select('*')
    .order('account_number')
    .limit(50)
  
  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log(`Found ${allGLs?.length || 0} GL accounts:\n`)
  
  allGLs?.forEach(gl => {
    console.log(`${gl.account_number} - ${gl.name}`)
    console.log(`  Type: ${gl.type || 'N/A'}, SubType: ${gl.sub_type || 'N/A'}`)
    console.log(`  is_bank_account: ${gl.is_bank_account || false}`)
    console.log(`  exclude_from_cash_balances: ${gl.exclude_from_cash_balances || false}`)
    console.log()
  })

  // Look for accounts that might be bank accounts based on name
  console.log('\n📋 Accounts that might be bank accounts (by name):')
  const bankLikeAccounts = allGLs?.filter(gl => 
    gl.name?.toLowerCase().includes('bank') ||
    gl.name?.toLowerCase().includes('cash') ||
    gl.name?.toLowerCase().includes('checking') ||
    gl.name?.toLowerCase().includes('savings') ||
    gl.sub_type === 'Cash' ||
    gl.sub_type === 'Bank'
  ) || []
  
  if (bankLikeAccounts.length === 0) {
    console.log('  No accounts found with bank-like names')
  } else {
    bankLikeAccounts.forEach(gl => {
      console.log(`  - ${gl.account_number} - ${gl.name} (is_bank_account: ${gl.is_bank_account || false})`)
    })
  }

  console.log('\n✅ Check complete!')
}

checkGLAccounts().catch(console.error)

