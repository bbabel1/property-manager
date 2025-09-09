import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function checkExistingBankAccounts() {
  try {
    console.log('🔍 Checking existing bank accounts in database...')
    
    const { data: bankAccounts, error } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    console.log('✅ Bank accounts in database:')
    console.log(JSON.stringify(bankAccounts, null, 2))
    
    // Also check the specific property
    console.log('\n🔍 Checking property 7647 details...')
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select(`
        id,
        name,
        operating_bank_account_id,
        deposit_trust_account_id,
        bank_accounts_operating:operating_bank_account_id(id, account_name, account_number),
        bank_accounts_trust:deposit_trust_account_id(id, account_name, account_number)
      `)
      .eq('name', '325 Lexington | Brandon Babel')
      .single()

    if (propertyError) {
      console.error('❌ Error fetching property:', propertyError)
    } else {
      console.log('✅ Property details:')
      console.log(JSON.stringify(property, null, 2))
    }
    
    return { bankAccounts, property }
  } catch (error) {
    console.error('❌ Error checking bank accounts:', error)
    throw error
  }
}

// Run the function
checkExistingBankAccounts()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
