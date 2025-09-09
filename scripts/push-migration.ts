#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'

function projectRefFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname // e.g., cidfgplknvueaivsxiqa.supabase.co
    const ref = host.split('.')[0]
    return ref || null
  } catch { return null }
}

function buildRemoteDatabaseUrl(): string | null {
  const ref = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!ref || !password) return null
  // Default database/user: postgres
  return `postgres://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
}

async function runSql(dbUrl: string, sql: string, label: string) {
  console.log(`Connecting to ${label}...`)
  const client = new Client({ connectionString: dbUrl, ssl: dbUrl.includes('.supabase.co') ? { rejectUnauthorized: false } : undefined })
  await client.connect()
  try {
    await client.query(sql)
    console.log(`Migration applied to ${label}`)
  } finally {
    await client.end()
  }
}

async function main() {
  const sqlPath = process.argv[2] || 'supabase/migrations/2025-08-29_owner_indexes.sql'
  const sql = readFileSync(resolve(sqlPath), 'utf8')

  const remote = buildRemoteDatabaseUrl()
  const local = process.env.LOCAL_DB_URL || 'postgres://postgres:postgres@localhost:54322/postgres'

  if (!remote) {
    console.warn('Remote DB URL could not be constructed. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD are set.')
  }

  // Push to local
  try {
    await runSql(local, sql, 'local')
  } catch (e) {
    console.warn('Local migration failed:', (e as Error).message)
  }

  // Push to remote
  if (remote) {
    try {
      await runSql(remote, sql, 'remote')
    } catch (e) {
      console.warn('Remote migration failed:', (e as Error).message)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

