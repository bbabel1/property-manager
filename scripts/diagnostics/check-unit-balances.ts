import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey)

type PropertyWithUnits = Database['public']['Tables']['properties']['Row'] & {
  units: Pick<Database['public']['Tables']['units']['Row'], 'id' | 'unit_number' | 'unit_name' | 'property_id'>[] | null
}

type TransactionLineWithAccount = Database['public']['Tables']['transaction_lines']['Row'] & {
  gl_accounts: Pick<
    Database['public']['Tables']['gl_accounts']['Row'],
    'id' | 'name' | 'is_bank_account' | 'exclude_from_cash_balances'
  > | null
}

async function checkUnitBalances() {
  console.log('🔍 Checking unit balances and property relationships...\n')

  // 1. Get the property and its units
  console.log('1. Property and its units:')
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      units(
        id,
        name,
        property_id
      )
    `)
    .limit(1)
    .single<PropertyWithUnits>()
  
  if (propError) {
    console.error('   ❌ Error:', propError.message)
    return
  }

  if (!property) {
    console.error('   ❌ No property returned from Supabase')
    return
  }

  console.log(`   Property: ${property.name} (${property.id})`)
  console.log(`   Units: ${property.units?.length || 0}`)
  property.units?.forEach(unit => {
    const unitLabel = unit.unit_name ?? unit.unit_number ?? 'Unit'
    console.log(`   - ${unitLabel} (${unit.id})`)
  })

  // 2. Check transaction lines for units
  console.log('\n2. Unit transaction lines:')
  if (property.units && property.units.length > 0) {
    for (const unit of property.units) {
      const { data: txLines, error: txError } = await supabase
        .from('transaction_lines')
        .select(`
          id,
          amount,
          posting_type,
          unit_id,
          gl_accounts!inner(
            id,
            name,
            is_bank_account
          )
        `)
        .eq('unit_id', unit.id)
        .limit(10)
        .returns<TransactionLineWithAccount[]>()
      
      if (txError) {
        const unitLabel = unit.unit_name ?? unit.unit_number ?? 'Unit'
        console.error(`   ❌ Error for unit ${unitLabel}:`, txError.message)
      } else {
        const unitLabel = unit.unit_name ?? unit.unit_number ?? 'Unit'
        console.log(`   Unit ${unitLabel}: ${txLines?.length || 0} transactions`)
        txLines?.forEach(tx => {
          const account = tx.gl_accounts
          const isBank = account?.is_bank_account ?? false
          console.log(`     - $${tx.amount} ${tx.posting_type} to ${account?.name ?? 'Unknown'} (bank: ${isBank})`)
        })
      }
    }
  }

  // 3. Check transaction lines for the property directly
  console.log('\n3. Property transaction lines:')
  const { data: propTxLines, error: propTxError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account
      )
    `)
    .eq('property_id', property.id)
    .limit(10)
    .returns<TransactionLineWithAccount[]>()
  
  if (propTxError) {
    console.error('   ❌ Error:', propTxError.message)
  } else {
    console.log(`   Property direct: ${propTxLines?.length || 0} transactions`)
    propTxLines?.forEach(tx => {
      const account = tx.gl_accounts
      const isBank = account?.is_bank_account ?? false
      const unitInfo = tx.unit_id ? ` (unit: ${tx.unit_id})` : ''
      console.log(`     - $${tx.amount} ${tx.posting_type} to ${account?.name ?? 'Unknown'} (bank: ${isBank})${unitInfo}`)
    })
  }

  // 4. Calculate what the property cash balance should be
  console.log('\n4. Calculating expected property cash balance:')
  
  // Get all bank account transactions for this property (including units)
  const { data: allBankTx, error: bankTxError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account,
        exclude_from_cash_balances
      )
    `)
    .or(`property_id.eq.${property.id},unit_id.in.(${property.units?.map(u => u.id).join(',') || 'null'})`)
    .eq('gl_accounts.is_bank_account', true)
    .eq('gl_accounts.exclude_from_cash_balances', false)
    .returns<TransactionLineWithAccount[]>()
  
  if (bankTxError) {
    console.error('   ❌ Error:', bankTxError.message)
  } else {
    console.log(`   Found ${allBankTx?.length || 0} bank account transactions`)
    
    let totalCash = 0
    allBankTx?.forEach(tx => {
      const amount = Number(tx.amount) || 0
      const signedAmount = tx.posting_type === 'Debit' ? amount : -amount
      totalCash += signedAmount
      const accountName = tx.gl_accounts?.name ?? 'Unknown'
      console.log(`     - $${tx.amount} ${tx.posting_type} = $${signedAmount} (${accountName})`)
    })
    
    console.log(`   Expected cash balance: $${totalCash}`)
    console.log(`   Current cached balance: $${property.cash_balance || 0}`)
  }

  console.log('\n✅ Check complete!')
}

checkUnitBalances().catch(console.error)
