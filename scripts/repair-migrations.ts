#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { Client } from 'pg'

type Columns = {
  hasVersion: boolean
  hasName: boolean
  hasInsertedAt: boolean
}

function getLocalDbUrl(): string {
  return (
    process.env.LOCAL_DB_URL ||
    // Default Supabase local dev Postgres
    'postgres://postgres:postgres@localhost:54322/postgres'
  )
}

function listMigrationBaseNames(): string[] {
  const dir = 'supabase/migrations'
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.sql.bak'))
    .sort((a, b) => a.localeCompare(b))
  return files.map((f) => basename(join(dir, f), '.sql'))
}

async function ensureTrackingTable(client: Client): Promise<Columns> {
  // Ensure schema exists (safe if it already exists)
  await client.query(`CREATE SCHEMA IF NOT EXISTS supabase_migrations;`)

  // If table doesn't exist, create a conservative table that is compatible
  // with Supabase CLI expectations (version primary key; optional name & inserted_at).
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
      ) THEN
        CREATE TABLE supabase_migrations.schema_migrations (
          version text PRIMARY KEY,
          name text,
          inserted_at timestamptz DEFAULT now()
        );
      END IF;
    END $$;
  `)

  // Detect columns so we can adapt to different CLI versions
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'`
  )
  const cols = rows.map((r) => r.column_name as string)
  return {
    hasVersion: cols.includes('version'),
    hasName: cols.includes('name'),
    hasInsertedAt: cols.includes('inserted_at') || cols.includes('applied_at'),
  }
}

async function fetchExistingVersions(client: Client): Promise<Set<string>> {
  // Prefer version column; if missing, fall back to name
  let res
  try {
    res = await client.query(`SELECT version FROM supabase_migrations.schema_migrations`)
    return new Set(res.rows.map((r) => String(r.version)))
  } catch {
    res = await client.query(`SELECT name FROM supabase_migrations.schema_migrations`)
    return new Set(res.rows.map((r) => String(r.name)))
  }
}

async function stampMigrations(options: { dryRun: boolean }) {
  const dbUrl = getLocalDbUrl()
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    const columns = await ensureTrackingTable(client)
    if (!columns.hasVersion && !columns.hasName) {
      throw new Error('schema_migrations missing both version and name columns; cannot proceed.')
    }

    const files = listMigrationBaseNames()
    const existing = await fetchExistingVersions(client)

    const toInsert = files.filter((v) => !existing.has(v))
    const already = files.filter((v) => existing.has(v))

    console.log(`Found ${files.length} migration files.`)
    console.log(`Already recorded: ${already.length}`)
    console.log(`To stamp:        ${toInsert.length}`)

    if (toInsert.length === 0) {
      console.log('Nothing to stamp. Migration history already matches files.')
      return
    }

    if (options.dryRun) {
      console.log('\n-- Dry run: would insert these rows --')
      toInsert.forEach((v) => console.log(v))
      return
    }

    // Insert missing rows in a single transaction
    await client.query('BEGIN')
    try {
      for (const v of toInsert) {
        if (columns.hasVersion && columns.hasName) {
          await client.query(
            `INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES ($1, $1) ON CONFLICT DO NOTHING`,
            [v]
          )
        } else if (columns.hasVersion) {
          await client.query(
            `INSERT INTO supabase_migrations.schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING`,
            [v]
          )
        } else {
          // Only name column
          await client.query(
            `INSERT INTO supabase_migrations.schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING`,
            [v]
          )
        }
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }

    console.log('Stamp complete.')
  } finally {
    await client.end()
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await stampMigrations({ dryRun })
}

main().catch((e) => {
  console.error('Failed to repair migrations:', e instanceof Error ? e.message : e)
  process.exit(1)
})

