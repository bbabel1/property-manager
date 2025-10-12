import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPropertyBankSetup() {
  console.log('🔍 Checking property bank account setup...\n')

  // 1. Get the property with all bank account details
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      operating_bank_account_id,
      deposit_trust_account_id
    `)
    .limit(1)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
    return
  }

  console.log(`Property: ${property.name}`)
  console.log(`Operating Bank Account ID: ${property.operating_bank_account_id}`)
  console.log(`Trust Account ID: ${property.deposit_trust_account_id}`)

  // 2. Check what these IDs point to in gl_accounts
  if (property.operating_bank_account_id) {
    const { data: operatingGL, error: opError } = await supabase
      .from('gl_accounts')
      .select('id, name, is_bank_account')
      .eq('id', property.operating_bank_account_id)
      .maybeSingle()
    
    if (opError) {
      console.error('❌ Error getting operating GL:', opError.message)
    } else if (operatingGL) {
      console.log(`Operating GL Account: ${operatingGL.name} (is_bank_account: ${operatingGL.is_bank_account})`)
    } else {
      console.log('Operating GL Account: Not found')
    }
  }

  if (property.deposit_trust_account_id) {
    const { data: trustGL, error: trustError } = await supabase
      .from('gl_accounts')
      .select('id, name, is_bank_account')
      .eq('id', property.deposit_trust_account_id)
      .maybeSingle()
    
    if (trustError) {
      console.error('❌ Error getting trust GL:', trustError.message)
    } else if (trustGL) {
      console.log(`Trust GL Account: ${trustGL.name} (is_bank_account: ${trustGL.is_bank_account})`)
    } else {
      console.log('Trust GL Account: Not found')
    }
  }

  // 3. Find any bank account GL that we can use
  console.log('\nAvailable bank account GLs:')
  const { data: bankGLs, error: bankError } = await supabase
    .from('gl_accounts')
    .select('id, name, is_bank_account')
    .eq('is_bank_account', true)
    .limit(5)
  
  if (bankError) {
    console.error('❌ Error getting bank GLs:', bankError.message)
  } else {
    bankGLs?.forEach(gl => {
      console.log(`  - ${gl.name} (${gl.id})`)
    })
  }

  console.log('\n✅ Check complete!')
}

checkPropertyBankSetup().catch(console.error)

