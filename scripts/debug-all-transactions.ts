import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugAllTransactions() {
  console.log('🔍 Debugging all transactions in the system...\n')

  // 1. Get all transaction lines
  const { data: allTx, error: allTxError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      lease_id,
      date,
      gl_accounts!inner(
        id,
        name,
        is_bank_account,
        exclude_from_cash_balances,
        type,
        sub_type
      )
    `)
    .order('date', { ascending: false })
  
  if (allTxError) {
    console.error('❌ Error getting transactions:', allTxError.message)
    return
  }

  console.log(`Found ${allTx?.length || 0} total transaction lines:\n`)

  allTx?.forEach((tx, index) => {
    const gl = tx.gl_accounts as any
    console.log(`${index + 1}. Transaction ${tx.id}:`)
    console.log(`   Amount: $${tx.amount} ${tx.posting_type}`)
    console.log(`   Date: ${tx.date}`)
    console.log(`   GL Account: ${gl.name} (${gl.type}/${gl.sub_type})`)
    console.log(`   Bank Account: ${gl.is_bank_account}`)
    console.log(`   Exclude from Cash: ${gl.exclude_from_cash_balances}`)
    console.log(`   Property: ${tx.property_id || 'null'}`)
    console.log(`   Unit: ${tx.unit_id || 'null'}`)
    console.log(`   Lease: ${tx.lease_id || 'null'}`)
    console.log()
  })

  // 2. Check what the migration function would calculate
  console.log('\n🔧 Testing migration function calculation...')
  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a' // From previous check
  
  // Get units for this property
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number')
    .eq('property_id', propertyId)

  console.log(`Property has ${units?.length || 0} units:`, units?.map(u => `${u.unit_number}(${u.id})`).join(', '))

  // Simulate the migration's cash calculation
  const { data: cashTx, error: cashError } = await supabase
    .from('transaction_lines')
    .select(`
      amount,
      posting_type,
      gl_accounts!inner(
        is_bank_account,
        exclude_from_cash_balances
      )
    `)
    .or(`property_id.eq.${propertyId},unit_id.in.(${units?.map(u => u.id).join(',') || 'null'})`)
    .eq('gl_accounts.is_bank_account', true)
    .eq('gl_accounts.exclude_from_cash_balances', false)

  if (cashError) {
    console.error('❌ Error in cash calculation:', cashError.message)
  } else {
    console.log(`Found ${cashTx?.length || 0} bank account transactions for cash calculation`)
    
    let totalCash = 0
    cashTx?.forEach(tx => {
      const amount = tx.posting_type === 'Debit' ? tx.amount : -tx.amount
      totalCash += amount
      console.log(`   $${tx.amount} ${tx.posting_type} = $${amount}`)
    })
    
    console.log(`Total cash balance: $${totalCash}`)
  }

  console.log('\n✅ Debug complete!')
}

debugAllTransactions().catch(console.error)


