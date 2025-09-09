import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

async function run(file) {
  const sqlPath = path.resolve(file)
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`)
    process.exit(1)
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const refMatch = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https?:\/\/([^.]+)\./)
  const ref = refMatch ? refMatch[1] : ''
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
    console.log(`Applying ${path.basename(sqlPath)} to remote ${host}...`)
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`Applied ${path.basename(sqlPath)} successfully`)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(`Failed applying ${path.basename(sqlPath)}:`, e.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

async function main() {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('Usage: node scripts/run-remote-sql.mjs <sql-file> [<sql-file> ...]')
    process.exit(1)
  }
  for (const f of files) {
    await run(f)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

