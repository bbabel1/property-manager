import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function createBankAccountForProperty() {
  try {
    console.log('🔍 Creating bank account for property 7647...')
    
    // First, let's get a GL account to use (we need one for the bank account)
    const { data: glAccounts, error: glError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, account_number')
      .eq('type', 'ASSET')
      .limit(1)

    if (glError) {
      throw new Error(`Error fetching GL accounts: ${glError.message}`)
    }

    if (!glAccounts || glAccounts.length === 0) {
      throw new Error('No GL accounts found. Need to create GL accounts first.')
    }

    const glAccount = glAccounts[0]
    console.log('✅ Using GL account:', glAccount)

    // Create the bank account
    const bankAccountData = {
      buildium_bank_id: 10407, // From Buildium property data
      name: '325 Lexington Operating Account',
      description: 'Operating bank account for 325 Lexington property',
      account_number: '****10407', // Placeholder since we can't get the real number
      routing_number: null, // We don't have this from Buildium
      is_active: true,
      balance: 0.00,
      buildium_balance: 0.00,
      gl_account: glAccount.id,
      country: 'United States' as const,
      check_printing_info: null,
      electronic_payments: null
    }

    console.log('🔍 Creating bank account with data:', bankAccountData)

    const { data: bankAccount, error: bankError } = await supabaseAdmin
      .from('bank_accounts')
      .insert(bankAccountData)
      .select()
      .single()

    if (bankError) {
      throw new Error(`Error creating bank account: ${bankError.message}`)
    }

    console.log('✅ Bank account created successfully:', bankAccount)

    // Now update the property with the bank account ID
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .update({
        operating_bank_account_id: bankAccount.id,
        updated_at: new Date().toISOString()
      })
      .eq('name', '325 Lexington | Brandon Babel')
      .select()
      .single()

    if (propertyError) {
      throw new Error(`Error updating property: ${propertyError.message}`)
    }

    console.log('✅ Property updated successfully:', property)
    
    return { bankAccount, property }
  } catch (error) {
    console.error('❌ Error creating bank account:', error)
    throw error
  }
}

// Run the function
createBankAccountForProperty()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
