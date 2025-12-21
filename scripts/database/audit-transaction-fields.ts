import { Client } from 'pg'
import { config } from 'dotenv'

config({ path: '.env' })

async function runQuery(client: Client, query: string, label: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Query: ${label}`)
  console.log('='.repeat(60))
  try {
    const result = await client.query(query)
    if (result.rows.length === 0) {
      console.log('✅ No issues found')
    } else {
      console.log(`⚠️  Found ${result.rows.length} row(s):`)
      console.table(result.rows)
    }
  } catch (e: any) {
    console.error(`❌ Error: ${e.message}`)
  }
}

async function main() {
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] || ''
  const host = `db.${ref}.supabase.co`
  const user = 'postgres'
  const database = 'postgres'
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) {
    console.error('SUPABASE_DB_PASSWORD is not set in .env')
    process.exit(1)
  }

  const client = new Client({
    host,
    port: 5432,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  })

  await client.connect()
  try {
    console.log(`🔍 Running audit queries on ${host}...\n`)

    // Query 1: Missing bank lines on payments/apply-deposits
    await runQuery(
      client,
      `SELECT
        t.id,
        t.buildium_transaction_id,
        t.transaction_type,
        t.date,
        t.total_amount,
        COUNT(*) FILTER (WHERE tl.is_bank_account) AS bank_lines,
        COUNT(*) FILTER (WHERE tl.is_cash_posting) AS cash_lines
      FROM transactions t
      LEFT JOIN (
        SELECT transaction_id, gl_account_id, is_cash_posting,
               (SELECT is_bank_account FROM gl_accounts g WHERE g.id = tlinner.gl_account_id) AS is_bank_account
        FROM transaction_lines tlinner
      ) tl ON tl.transaction_id = t.id
      WHERE t.transaction_type IN ('Payment', 'ApplyDeposit')
      GROUP BY 1,2,3,4,5
      HAVING COUNT(*) FILTER (WHERE tl.is_bank_account) = 0`,
      '1) Missing bank lines on payments/apply-deposits'
    )

    // Query 2: Unbalanced transactions (double-entry)
    await runQuery(
      client,
      `SELECT
        t.id,
        t.buildium_transaction_id,
        t.transaction_type,
        SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END) AS debits,
        SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END) AS credits
      FROM transactions t
      JOIN transaction_lines tl ON tl.transaction_id = t.id
      GROUP BY 1,2,3
      HAVING ABS(SUM(CASE WHEN tl.posting_type = 'Debit' THEN tl.amount ELSE 0 END) -
                 SUM(CASE WHEN tl.posting_type = 'Credit' THEN tl.amount ELSE 0 END)) > 0.0001`,
      '2) Unbalanced transactions (double-entry)'
    )

    // Query 3: Orphaned payment splits (transaction deleted)
    await runQuery(
      client,
      `SELECT s.*
      FROM transaction_payment_transactions s
      LEFT JOIN transactions t ON t.id = s.transaction_id
      WHERE t.id IS NULL`,
      '3) Orphaned payment splits (transaction deleted)'
    )

    // Query 4: Missing splits on deposits with BankGLAccountId
    await runQuery(
      client,
      `SELECT
        t.id,
        t.buildium_transaction_id,
        t.bank_gl_account_buildium_id,
        COUNT(s.id) AS split_count
      FROM transactions t
      LEFT JOIN transaction_payment_transactions s ON s.transaction_id = t.id
      WHERE t.bank_gl_account_buildium_id IS NOT NULL
      GROUP BY 1,2,3
      HAVING COUNT(s.id) = 0`,
      '4) Missing splits on deposits with BankGLAccountId'
    )

    console.log(`\n${'='.repeat(60)}`)
    console.log('✅ Audit complete')
    console.log('='.repeat(60))
  } catch (e: any) {
    console.error(`❌ Fatal error: ${e.message}`)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})

