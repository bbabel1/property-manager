// @ts-nocheck
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLeaseTransactions() {
  try {
    console.log('🔍 Checking Lease Transactions...\n')

    // Get the active lease
    const { data: leases, error: leaseError } = await supabase
      .from('lease')
      .select('id, unit_id, status, rent_amount, security_deposit')
      .eq('status', 'active')
      .limit(1)

    if (leaseError) {
      console.error('❌ Error fetching leases:', leaseError)
      return
    }

    if (!leases || leases.length === 0) {
      console.log('⚠️ No active leases found')
      return
    }

    const activeLease = leases[0]
    console.log(`🎯 Active Lease: ID ${activeLease.id}, Rent: $${activeLease.rent_amount}`)

    // Check transaction lines for this lease
    const { data: transactionLines, error: txError } = await supabase
      .from('transaction_lines')
      .select('id, amount, posting_type, date, memo, gl_account_id, gl_accounts(type, is_bank_account, name)')
      .eq('lease_id', activeLease.id)
      .order('date', { ascending: false })

    if (txError) {
      console.error('❌ Error fetching transaction lines:', txError)
      return
    }

    console.log(`\n💰 Found ${transactionLines?.length || 0} transaction lines for lease ${activeLease.id}`)
    
    if (transactionLines && transactionLines.length > 0) {
      console.log('\n📋 Transaction Lines:')
      transactionLines.forEach(line => {
        console.log(`  - ${line.date}: ${line.posting_type} $${line.amount} (${line.gl_accounts?.name || 'Unknown'})`)
      })

      // Calculate balance
      let balance = 0
      let prepaymentBalance = 0
      
      for (const line of transactionLines) {
        const amount = Number(line.amount) || 0
        const isDebit = line.posting_type === 'Debit'
        const accountType = line.gl_accounts?.type?.toLowerCase()
        const isBankAccount = line.gl_accounts?.is_bank_account
        
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
    } else {
      console.log('⚠️ No transaction lines found - this explains why balance is $0.00')
      console.log('   The lease exists but has no financial transactions yet.')
    }

    // Let's also check if there are any transactions at all in the system
    const { data: allTransactions, error: allTxError } = await supabase
      .from('transaction_lines')
      .select('id, lease_id')
      .limit(10)
    
    if (allTxError) {
      console.error('❌ Error checking for any transactions:', allTxError)
    } else {
      console.log(`\n🔍 Total transaction lines in system: ${allTransactions?.length || 0}`)
      if (allTransactions && allTransactions.length > 0) {
        const leaseIds = [...new Set(allTransactions.map(t => t.lease_id).filter(Boolean))]
        console.log(`   Found transaction lines for lease IDs: ${leaseIds.join(', ')}`)
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkLeaseTransactions()
