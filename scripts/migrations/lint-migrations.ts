#!/usr/bin/env -S node --loader tsx
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const RE = /^\d{14}_\d{3}_[a-z0-9_]+\.sql$/

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.sql.bak'))

  const bad = files.filter(f => !RE.test(f))
  if (bad.length) {
    console.error('Invalid migration filenames:')
    for (const f of bad) console.error('  ' + f)
    console.error('\nExpected pattern: YYYYMMDDHHMMSS_NNN_description.sql')
    process.exit(1)
  }
  console.log('All migration filenames valid.')
}

main()

