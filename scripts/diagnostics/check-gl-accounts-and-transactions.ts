import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log('🔍 Checking GL accounts and transactions...\n')

  // 1. Check total transaction lines
  console.log('1. Checking transaction_lines:')
  const { count: totalTx, error: txError } = await supabase
    .from('transaction_lines')
    .select('*', { count: 'exact', head: true })
  
  if (txError) {
    console.error('   ❌ Error:', txError.message)
  } else {
    console.log(`   Total transaction_lines: ${totalTx || 0}`)
  }

  // 2. Check GL accounts marked as bank accounts
  console.log('\n2. Checking GL accounts marked as bank accounts:')
  const { data: bankGLs, error: bankError } = await supabase
    .from('gl_accounts')
    .select('id, name, account_type, account_sub_type, is_bank_account, exclude_from_cash_balances')
    .eq('is_bank_account', true)
    .limit(10)
  
  if (bankError) {
    console.error('   ❌ Error:', bankError.message)
  } else {
    console.log(`   Found ${bankGLs?.length || 0} GL accounts marked as bank accounts:`)
    bankGLs?.forEach(gl => {
      console.log(`   - ${gl.name} (${gl.account_type}/${gl.account_sub_type})`)
      console.log(`     Exclude from cash: ${gl.exclude_from_cash_balances || false}`)
    })
  }

  // 3. Check transaction lines for each bank GL account
  if (bankGLs && bankGLs.length > 0) {
    console.log('\n3. Checking transactions for bank GL accounts:')
    for (const gl of bankGLs) {
      const { count, error } = await supabase
        .from('transaction_lines')
        .select('*', { count: 'exact', head: true })
        .eq('gl_account_id', gl.id)
      
      if (error) {
        console.error(`   ❌ Error for ${gl.name}:`, error.message)
      } else {
        console.log(`   - ${gl.name}: ${count || 0} transactions`)
      }
    }
  }

  // 4. Sample some transaction lines with their GL accounts
  console.log('\n4. Sample transaction lines:')
  const { data: sampleTx, error: sampleError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account
      )
    `)
    .limit(5)
  
  if (sampleError) {
    console.error('   ❌ Error:', sampleError.message)
  } else {
    console.log(`   Found ${sampleTx?.length || 0} sample transactions:`)
    sampleTx?.forEach(tx => {
      console.log(`   - $${tx.amount} ${tx.posting_type}`)
      console.log(`     GL: ${(tx.gl_accounts as any).name} (is_bank_account: ${(tx.gl_accounts as any).is_bank_account})`)
    })
  }

  console.log('\n✅ Check complete!')
}

checkData().catch(console.error)


