import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testFinalLogic() {
  try {
    console.log('🧪 Testing Final Unit Details Logic...\n')

    // Use the unit ID we know has the lease
    const unitId = 'e7c899b8-d286-45de-9bed-f2856ff9ccf5'
    
    console.log(`🏠 Testing with Unit ID: ${unitId}`)

    // Load leases for this unit (exact copy of unit details page logic)
    const { data: leaseRows } = await supabase
      .from('lease')
      .select('id, lease_from_date, lease_to_date, status, rent_amount, buildium_lease_id, sync_status, last_sync_error, last_sync_attempt_at')
      .eq('unit_id', unitId)
      .order('lease_from_date', { ascending: false })

    const leases = Array.isArray(leaseRows) ? leaseRows : []
    console.log(`📋 Found ${leases.length} leases for unit ${unitId}`)

    if (leases.length === 0) {
      console.log('⚠️ No leases found for this unit')
      return
    }

    // Show all leases
    leases.forEach((lease, index) => {
      console.log(`  ${index + 1}. ID: ${lease.id}, Status: "${lease.status}", Rent: $${lease.rent_amount}`)
    })

    // Calculate unit-specific balance from active lease (exact copy of unit details page logic)
    let unitBalance = 0
    let activeLeaseRent = null
    let depositsHeld = 0
    let prepayments = 0
    
    if (leases.length > 0) {
      // Get the most recent active lease (exact copy)
      const activeLease = leases.find(l => l.status?.toLowerCase() === 'active' || l.status?.toLowerCase() === 'current') || leases[0]
      
      console.log(`\n🎯 Active Lease Found:`)
      console.log(`  - ID: ${activeLease.id}`)
      console.log(`  - Status: "${activeLease.status}"`)
      console.log(`  - Rent Amount: $${activeLease.rent_amount}`)
      
      activeLeaseRent = activeLease?.rent_amount || null
      
      // Calculate balance from lease transactions (exact copy)
      if (activeLease?.id) {
        try {
          console.log(`\n🔍 Querying transaction lines for lease ${activeLease.id}...`)
          
          // Query transaction lines for this lease to calculate balance
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
              
              // Calculate running balance (exact copy)
              if (isDebit) {
                balance += amount  // Tenant owes more (charges, rent)
                console.log(`    -> Balance: $${balance.toFixed(2)} (added $${amount})`)
              } else {
                balance -= amount  // Tenant owes less (payments, credits)
                console.log(`    -> Balance: $${balance.toFixed(2)} (subtracted $${amount})`)
              }
              
              // Track prepayments (income accounts that represent prepaid rent)
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
          } else {
            console.log('⚠️ No transaction lines found')
          }
          
          depositsHeld = activeLease?.security_deposit || 0
        } catch (error) {
          console.error('❌ Error calculating lease balance:', error)
          // Fallback to default values
          unitBalance = 0
          depositsHeld = activeLease?.security_deposit || 0
          prepayments = 0
        }
      }
    }

    // Financial summary (unit-specific) - exact copy
    const unitFin = {
      cash_balance: unitBalance,
      security_deposits: depositsHeld,
      reserve: 0,
      available_balance: unitBalance,
      as_of: new Date().toISOString().slice(0, 10)
    }

    console.log(`\n🎯 UnitBalanceCard would receive:`)
    console.log(`  - fin.available_balance: $${unitFin.available_balance.toFixed(2)}`)
    console.log(`  - rent: $${activeLeaseRent}`)
    console.log(`  - prepayments: $${prepayments}`)

    console.log(`\n✅ This should show:`)
    console.log(`  - Balance: $${unitFin.available_balance.toFixed(2)}`)
    console.log(`  - Rent: $${activeLeaseRent}`)

    // Test the UnitBalanceCard component logic
    console.log(`\n🧮 UnitBalanceCard Display Logic:`)
    const fmt = (n?: number | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
    
    console.log(`  - Balance: ${fmt(unitFin.available_balance)}`)
    console.log(`  - Prepayments: ${fmt(prepayments)}`)
    console.log(`  - Deposits held: ${fmt(unitFin.security_deposits)}`)
    console.log(`  - Rent: ${fmt(activeLeaseRent)}`)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testFinalLogic()
