import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBankGLTransactions() {
  console.log('🔍 Checking bank GL transaction lines...\n')

  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'

  // 1. Get units for this property
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId)
  
  if (unitsError) {
    console.error('❌ Error getting units:', unitsError.message)
    return
  }

  // 2. Get leases for this property
  const { data: leases, error: leasesError } = await supabase
    .from('lease')
    .select('id')
    .eq('property_id', propertyId)
  
  if (leasesError) {
    console.error('❌ Error getting leases:', leasesError.message)
    return
  }

  const unitIds = units?.map(u => u.id) || []
  const leaseIds = leases?.map(l => l.id) || []

  console.log(`Property has ${unitIds.length} units and ${leaseIds.length} leases`)

  // 3. Check bank GL transaction lines
  let bankTxLines: any[] = []
  
  // Check property-level transactions
  const { data: propBankTx, error: propError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      lease_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account,
        exclude_from_cash_balances
      )
    `)
    .eq('property_id', propertyId)
    .eq('gl_accounts.is_bank_account', true)
    .eq('gl_accounts.exclude_from_cash_balances', false)
  
  if (propError) {
    console.error('❌ Error getting property bank transactions:', propError.message)
  } else {
    bankTxLines = bankTxLines.concat(propBankTx || [])
  }

  // Check unit-level transactions
  if (unitIds.length > 0) {
    const { data: unitBankTx, error: unitError } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        amount,
        posting_type,
        property_id,
        unit_id,
        lease_id,
        gl_accounts!inner(
          id,
          name,
          is_bank_account,
          exclude_from_cash_balances
        )
      `)
      .in('unit_id', unitIds)
      .eq('gl_accounts.is_bank_account', true)
      .eq('gl_accounts.exclude_from_cash_balances', false)
    
    if (unitError) {
      console.error('❌ Error getting unit bank transactions:', unitError.message)
    } else {
      bankTxLines = bankTxLines.concat(unitBankTx || [])
    }
  }

  // Check lease-level transactions
  if (leaseIds.length > 0) {
    const { data: leaseBankTx, error: leaseError } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        amount,
        posting_type,
        property_id,
        unit_id,
        lease_id,
        gl_accounts!inner(
          id,
          name,
          is_bank_account,
          exclude_from_cash_balances
        )
      `)
      .in('lease_id', leaseIds)
      .eq('gl_accounts.is_bank_account', true)
      .eq('gl_accounts.exclude_from_cash_balances', false)
    
    if (leaseError) {
      console.error('❌ Error getting lease bank transactions:', leaseError.message)
    } else {
      bankTxLines = bankTxLines.concat(leaseBankTx || [])
    }
  }

  // Remove duplicates
  const uniqueBankTx = bankTxLines.filter((tx, index, self) => 
    index === self.findIndex(t => t.id === tx.id)
  )

  console.log(`\nFound ${uniqueBankTx.length} bank GL transaction lines:`)
  
  let calculatedCash = 0
  uniqueBankTx.forEach(tx => {
    const amount = tx.posting_type === 'Debit' ? tx.amount : -tx.amount
    calculatedCash += amount
    const source = tx.property_id ? 'property' : tx.unit_id ? 'unit' : 'lease'
    console.log(`   - $${tx.amount} ${tx.posting_type} = $${amount} (${(tx.gl_accounts as any).name}, ${source})`)
  })
  
  console.log(`\nCalculated Cash Balance: $${calculatedCash}`)

  // 4. Check current property balance
  const { data: property, error: propError2 } = await supabase
    .from('properties')
    .select('cash_balance, available_balance')
    .eq('id', propertyId)
    .single()
  
  if (propError2) {
    console.error('❌ Error getting property:', propError2.message)
  } else {
    console.log(`Cached Cash Balance: $${property.cash_balance}`)
    console.log(`Cached Available Balance: $${property.available_balance}`)
    
    if (Math.abs(calculatedCash - (property.cash_balance || 0)) < 0.01) {
      console.log('✅ Property cash balance calculation is correct!')
    } else {
      console.log('❌ Property cash balance calculation mismatch!')
    }
  }

  console.log('\n✅ Check complete!')
}

checkBankGLTransactions().catch(console.error)























