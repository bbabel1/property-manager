import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolveGLAccountId } from '@/lib/buildium-mappers'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createTransactionLine(transactionId: string, line: any, journalMemo: string) {
  // Determine posting type based on amount sign
  const postingType = line.Amount >= 0 ? 'Credit' : 'Debit'

  // Resolve or create GL account using shared mapper
  const glAccountId = await resolveGLAccountId(line?.GLAccount?.Id ?? line?.GLAccount, supabase)

  const transactionLineData = {
    transaction_id: transactionId,
    gl_account_id: glAccountId,
    amount: Math.abs(line.Amount), // Store absolute value
    posting_type: postingType,
    memo: line.Memo || journalMemo,
    account_entity_type: 'Rental' as const, // Required field for existing transaction_lines table
    date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('transaction_lines')
    .insert(transactionLineData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create transaction line: ${error.message}`)
  }

  return data
}

async function fetchFullTransactionFromBuildium(transactionId: string) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/16235/transactions/${transactionId}`

  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'x-buildium-egress-allowed': '1',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  return response.json()
}

async function main() {
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  console.log('🔄 Creating transaction lines from Buildium transactions...')

  try {
    // Get all transactions for lease 16235
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, buildium_transaction_id')
      .eq('buildium_lease_id', 16235)

    if (fetchError) {
      throw new Error(`Failed to fetch transactions: ${fetchError.message}`)
    }

    if (!transactions || transactions.length === 0) {
      console.log('No transactions found for lease 16235')
      return
    }

    console.log(`Found ${transactions.length} transactions to process`)

    for (const transaction of transactions) {
      console.log(`Processing transaction ${transaction.buildium_transaction_id}...`)

      try {
        // Fetch full transaction details from Buildium
        const buildiumTransaction = await fetchFullTransactionFromBuildium(transaction.buildium_transaction_id.toString())

        if (buildiumTransaction.Journal && buildiumTransaction.Journal.Lines) {
          console.log(`  Found ${buildiumTransaction.Journal.Lines.length} lines to process`)

          for (const line of buildiumTransaction.Journal.Lines) {
            const transactionLine = await createTransactionLine(
              transaction.id,
              line,
              buildiumTransaction.Journal.Memo || ''
            )
            console.log(`  ✅ Created transaction line ${transactionLine.id} for GL account ${line.GLAccount.Name}`)
          }
        } else {
          console.log(`  No journal lines found for transaction ${transaction.buildium_transaction_id}`)
        }
      } catch (error) {
        console.error(`  ❌ Error processing transaction ${transaction.buildium_transaction_id}:`, error)
      }
    }

    console.log('🎉 Successfully created transaction lines for all transactions')

  } catch (error) {
    console.error('❌ Error creating transaction lines:', error)
    throw error
  }
}

// Run the script
main()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
