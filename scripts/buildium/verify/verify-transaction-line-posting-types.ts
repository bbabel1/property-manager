import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyPostingTypes() {
  console.log('🔍 Verifying posting types in transaction lines...')

  try {
    const { data: transactionLines, error } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        amount,
        posting_type,
        gl_account:gl_accounts(
          id,
          name,
          type
        )
      `)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch transaction lines: ${error.message}`)
    }

    console.log(`Found ${transactionLines?.length || 0} transaction lines`)

    if (transactionLines && transactionLines.length > 0) {
      console.log('\n📋 Transaction Lines with Posting Types:')
      
      transactionLines.forEach((line, index) => {
        console.log(`\n${index + 1}. Transaction Line ID: ${line.id}`)
        console.log(`   Amount: $${line.amount}`)
        console.log(`   Posting Type: ${line.posting_type}`)
        console.log(`   GL Account: ${line.gl_account?.name} (${line.gl_account?.type})`)
      })

      // Summary by posting type
      const creditCount = transactionLines.filter(line => line.posting_type === 'Credit').length
      const debitCount = transactionLines.filter(line => line.posting_type === 'Debit').length

      console.log('\n📊 Posting Type Summary:')
      console.log(`   Credits: ${creditCount}`)
      console.log(`   Debits: ${debitCount}`)
      console.log(`   Total: ${transactionLines.length}`)
    }

  } catch (error) {
    console.error('❌ Error verifying posting types:', error)
    throw error
  }
}

// Run the verification
verifyPostingTypes()
  .then(() => {
    console.log('✅ Verification completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  })
