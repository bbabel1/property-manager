import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function createGLAccountAndBankAccount() {
  try {
    console.log('🔍 Creating GL account and bank account for property 7647...')
    
    // First, check if we have any GL accounts
    const { data: existingGLAccounts, error: glError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, account_number, type')
      .limit(5)

    if (glError) {
      throw new Error(`Error fetching GL accounts: ${glError.message}`)
    }

    console.log('✅ Existing GL accounts:', existingGLAccounts)

    let glAccount
    if (existingGLAccounts && existingGLAccounts.length > 0) {
      // Use the first existing GL account
      glAccount = existingGLAccounts[0]
      console.log('✅ Using existing GL account:', glAccount)
    } else {
      // Create a new GL account
      console.log('🔍 Creating new GL account...')
      const glAccountData = {
        buildium_gl_account_id: 1001, // Placeholder ID
        account_number: '1000',
        name: 'Cash - Operating Account',
        description: 'Operating cash account for properties',
        type: 'ASSET',
        sub_type: 'CASH',
        is_default_gl_account: false,
        is_contra_account: false,
        is_bank_account: true,
        cash_flow_classification: 'OPERATING',
        exclude_from_cash_balances: false,
        is_active: true,
        is_credit_card_account: false
      }

      const { data: newGLAccount, error: newGLError } = await supabaseAdmin
        .from('gl_accounts')
        .insert(glAccountData)
        .select()
        .single()

      if (newGLError) {
        throw new Error(`Error creating GL account: ${newGLError.message}`)
      }

      glAccount = newGLAccount
      console.log('✅ GL account created:', glAccount)
    }

    // Now create the bank account
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
      electronic_payments: null,
      updated_at: new Date().toISOString()
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
    
    return { glAccount, bankAccount, property }
  } catch (error) {
    console.error('❌ Error creating GL account and bank account:', error)
    throw error
  }
}

// Run the function
createGLAccountAndBankAccount()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
