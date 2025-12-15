// @ts-nocheck
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function findUnitWithLease() {
  try {
    console.log('🔍 Finding Unit with Active Lease...\n')

    // Get the active lease we know exists
    const { data: lease, error: leaseError } = await supabase
      .from('lease')
      .select('id, unit_id, status, rent_amount, security_deposit')
      .eq('status', 'active')
      .single()

    if (leaseError) {
      console.error('❌ Error fetching lease:', leaseError)
      return
    }

    console.log(`🎯 Active Lease: ID ${lease.id}, Unit ID: ${lease.unit_id}, Rent: $${lease.rent_amount}`)

    // Get the unit for this lease
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, unit_number, unit_name, property_id')
      .eq('id', lease.unit_id)
      .single()

    if (unitError) {
      console.error('❌ Error fetching unit:', unitError)
      return
    }

    console.log(`🏠 Unit: ${unit.unit_number} (${unit.unit_name}) - Property ID: ${unit.property_id}`)

    // Now test the unit details logic with this specific unit
    console.log(`\n🧪 Testing Unit Details Logic for Unit ${unit.unit_number}...`)

    // Load leases for this unit (exact copy of unit details page logic)
    const { data: leaseRows } = await supabase
      .from('lease')
      .select('id, lease_from_date, lease_to_date, status, rent_amount, buildium_lease_id, sync_status, last_sync_error, last_sync_attempt_at')
      .eq('unit_id', unit.id)
      .order('lease_from_date', { ascending: false })

    const leases = Array.isArray(leaseRows) ? leaseRows : []
    console.log(`📋 Found ${leases.length} leases for unit ${unit.unit_number}`)

    if (leases.length > 0) {
      // Calculate unit-specific balance from active lease
      let unitBalance = 0
      let activeLeaseRent = null
      let depositsHeld = 0
      let prepayments = 0
      
      // Get the most recent active lease
      const activeLease = leases.find(l => l.status?.toLowerCase() === 'active' || l.status?.toLowerCase() === 'current') || leases[0]
      
      console.log(`\n🎯 Active Lease Found:`)
      console.log(`  - ID: ${activeLease.id}`)
      console.log(`  - Status: "${activeLease.status}"`)
      console.log(`  - Rent Amount: $${activeLease.rent_amount}`)
      
      activeLeaseRent = activeLease?.rent_amount || null
      
      // Calculate balance from lease transactions
      if (activeLease?.id) {
        try {
          console.log(`\n🔍 Querying transaction lines for lease ${activeLease.id}...`)
          
          const { data: transactionLines } = await supabase
            .from('transaction_lines')
            .select('amount, posting_type, gl_account_id, gl_accounts(type, is_bank_account)')
            .eq('lease_id', activeLease.id)
          
          console.log(`💰 Found ${transactionLines?.length || 0} transaction lines`)
          
          if (transactionLines && transactionLines.length > 0) {
            let balance = 0
            let prepaymentBalance = 0
            
            console.log(`\n📋 Processing transaction lines:`)
            
            for (const line of transactionLines) {
              const amount = Number(line.amount) || 0
              const isDebit = line.posting_type === 'Debit'
              const accountType = line.gl_accounts?.type?.toLowerCase()
              const isBankAccount = line.gl_accounts?.is_bank_account
              
              console.log(`  - ${line.posting_type} $${amount} (Type: ${accountType}, Bank: ${isBankAccount})`)
              
              // Calculate running balance
              if (isDebit) {
                balance += amount
                console.log(`    -> Balance: $${balance.toFixed(2)} (added $${amount})`)
              } else {
                balance -= amount
                console.log(`    -> Balance: $${balance.toFixed(2)} (subtracted $${amount})`)
              }
              
              // Track prepayments
              if (accountType === 'income' && !isBankAccount && line.posting_type === 'Credit') {
                prepaymentBalance += amount
                console.log(`    -> Prepayment: $${prepaymentBalance.toFixed(2)} (added $${amount})`)
              }
            }
            
            unitBalance = balance
            prepayments = prepaymentBalance
            
            console.log(`\n📊 Final Results:`)
            console.log(`  - Unit Balance: $${unitBalance.toFixed(2)}`)
            console.log(`  - Prepayments: $${prepayments.toFixed(2)}`)
            console.log(`  - Security Deposit: $${activeLease?.security_deposit || 0}`)
            console.log(`  - Active Lease Rent: $${activeLeaseRent}`)
            
            // Financial summary (unit-specific)
            const unitFin = {
              cash_balance: unitBalance,
              security_deposits: activeLease?.security_deposit || 0,
              reserve: 0,
              available_balance: unitBalance,
              as_of: new Date().toISOString().slice(0, 10)
            }

            console.log(`\n🎯 UnitBalanceCard would receive:`)
            console.log(`  - fin.available_balance: $${unitFin.available_balance.toFixed(2)}`)
            console.log(`  - rent: $${activeLeaseRent}`)
            console.log(`  - prepayments: $${prepayments}`)
          } else {
            console.log('⚠️ No transaction lines found')
          }
          
          depositsHeld = activeLease?.security_deposit || 0
        } catch (error) {
          console.error('❌ Error calculating lease balance:', error)
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

findUnitWithLease()
