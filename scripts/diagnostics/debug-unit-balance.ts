// @ts-nocheck
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugUnitBalance() {
  try {
    console.log('🔍 Debugging Unit Balance Calculation...\n')

    // First, let's find a unit with an active lease
    const { data: leases, error: leaseError } = await supabase
      .from('lease')
      .select('id, unit_id, status, rent_amount, security_deposit, buildium_lease_id')
      .in('status', ['Active', 'Current'])
      .limit(5)

    if (leaseError) {
      console.error('❌ Error fetching leases:', leaseError)
      return
    }

    console.log(`📋 Found ${leases?.length || 0} active leases:`)
    leases?.forEach(lease => {
      console.log(`  - Lease ID: ${lease.id}, Unit ID: ${lease.unit_id}, Status: ${lease.status}, Rent: $${lease.rent_amount}`)
    })

    if (!leases || leases.length === 0) {
      console.log('⚠️ No active leases found')
      return
    }

    // Let's check the first active lease
    const testLease = leases[0]
    console.log(`\n🎯 Testing with Lease ID: ${testLease.id}`)

    // Check if there are any transaction lines for this lease
    const { data: transactionLines, error: txError } = await supabase
      .from('transaction_lines')
      .select('id, amount, posting_type, date, memo, gl_account_id, gl_accounts(type, is_bank_account, name)')
      .eq('lease_id', testLease.id)
      .order('date', { ascending: false })

    if (txError) {
      console.error('❌ Error fetching transaction lines:', txError)
    } else {
      console.log(`\n💰 Found ${transactionLines?.length || 0} transaction lines for lease ${testLease.id}:`)
      
      if (transactionLines && transactionLines.length > 0) {
        transactionLines.forEach(line => {
          console.log(`  - ${line.date}: ${line.posting_type} $${line.amount} (${line.gl_accounts?.name || 'Unknown Account'})`)
        })

        // Calculate balance
        let balance = 0
        let prepaymentBalance = 0
        
        for (const line of transactionLines) {
          const amount = Number(line.amount) || 0
          const isDebit = line.posting_type === 'Debit'
          const accountType = line.gl_accounts?.type?.toLowerCase()
          const isBankAccount = line.gl_accounts?.is_bank_account
          
          console.log(`    Processing: ${line.posting_type} $${amount} (Type: ${accountType}, Bank: ${isBankAccount})`)
          
          if (isDebit) {
            balance += amount
          } else {
            balance -= amount
          }
          
          if (accountType === 'income' && !isBankAccount && line.posting_type === 'Credit') {
            prepaymentBalance += amount
          }
        }
        
        console.log(`\n📊 Calculated Balance: $${balance.toFixed(2)}`)
        console.log(`📊 Calculated Prepayments: $${prepaymentBalance.toFixed(2)}`)
        console.log(`📊 Security Deposit: $${testLease.security_deposit || 0}`)
      } else {
        console.log('⚠️ No transaction lines found - this explains why balance is $0.00')
        
        // Let's check if there are any transactions at all
        const { data: allTransactions, error: allTxError } = await supabase
          .from('transaction_lines')
          .select('lease_id')
          .not('lease_id', 'is', null)
          .limit(10)
        
        if (allTxError) {
          console.error('❌ Error checking for any transactions:', allTxError)
        } else {
          console.log(`\n🔍 Found ${allTransactions?.length || 0} total transaction lines with lease_id`)
          if (allTransactions && allTransactions.length > 0) {
            console.log('   Sample lease_ids:', allTransactions.map(t => t.lease_id).slice(0, 5))
          }
        }
      }
    }

    // Let's also check the unit details
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, unit_number, unit_name, market_rent')
      .eq('id', testLease.unit_id)
      .single()

    if (unitError) {
      console.error('❌ Error fetching unit:', unitError)
    } else {
      console.log(`\n🏠 Unit Details:`)
      console.log(`  - Unit Number: ${unit.unit_number}`)
      console.log(`  - Unit Name: ${unit.unit_name}`)
      console.log(`  - Market Rent: $${unit.market_rent || 0}`)
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

debugUnitBalance()
