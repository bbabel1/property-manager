import { readFileSync } from 'fs'
import { Client } from 'pg'

/**
 * Apply a SQL file to a Postgres database using DSN.
 * Usage:
 *   npx tsx scripts/sql/apply_sql.ts --dsn "postgresql://..." --file "path/to/file.sql"
 */
async function main() {
  const args = process.argv.slice(2)
  const dsnIdx = args.indexOf('--dsn')
  const fileIdx = args.indexOf('--file')
  if (dsnIdx === -1 || fileIdx === -1) {
    console.error('Usage: tsx scripts/sql/apply_sql.ts --dsn <connection-string> --file <sql-file>')
    process.exit(1)
  }
  const dsn = args[dsnIdx + 1]
  const file = args[fileIdx + 1]
  const sql = readFileSync(file, 'utf8')

  const ssl = dsn.includes('supabase.co') ? { rejectUnauthorized: false } : undefined as any
  const client = new Client({ connectionString: dsn, ssl })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`✅ Applied SQL from ${file}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`❌ Failed applying ${file}:`, (err as Error).message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
