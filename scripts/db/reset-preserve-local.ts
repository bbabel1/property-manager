#!/usr/bin/env -S node --loader tsx
import { spawnSync } from 'node:child_process'
import { mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function sh(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${res.status})`)
}

function lastBackup(): { schema?: string; data?: string } {
  const dir = 'backups/local'
  if (!existsSync(dir)) return {}
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const latestData = [...files].reverse().find(f => f.startsWith('data_'))
  const latestSchema = [...files].reverse().find(f => f.startsWith('schema_'))
  return {
    schema: latestSchema ? join(dir, latestSchema) : undefined,
    data: latestData ? join(dir, latestData) : undefined,
  }
}

function ts() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// 1) Backup schema and data
const dir = 'backups/local'
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const stamp = ts()
const schemaFile = `${dir}/schema_${stamp}.sql`
const dataFile = `${dir}/data_${stamp}.sql`

console.log(`[1/5] Backing up schema → ${schemaFile}`)
sh('npx', ['supabase@latest', 'db', 'dump', '--local', '--schema', 'public', '--file', schemaFile])

console.log(`[2/5] Backing up data → ${dataFile}`)
sh('npx', ['supabase@latest', 'db', 'dump', '--local', '--schema', 'public', '--data-only', '--file', dataFile])

// 2) Reset local DB (replay migrations)
console.log('[3/5] Resetting local database and replaying migrations')
sh('npx', ['supabase@latest', 'db', 'reset', '--local'])

// 3) Apply any new local migrations explicitly (usually covered by reset)
console.log('[4/5] Pushing pending migrations (if any)')
sh('npx', ['supabase@latest', 'db', 'push', '--local'])

// 4) Restore data from the most recent backup (use the one we just created)
const backup = { schema: schemaFile, data: dataFile }
console.log(`[5/5] Restoring data from ${backup.data}`)
sh('npx', ['supabase@latest', 'db', 'execute', '--file', backup.data!])

console.log('Local database reset completed with data preserved.')

