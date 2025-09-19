#!/usr/bin/env -S node --loader tsx
import { mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function sh(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${res.status})`)
}

function ts() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

const dir = 'backups/local'
if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
const stamp = ts()
const schemaFile = `${dir}/schema_${stamp}.sql`
const dataFile = `${dir}/data_${stamp}.sql`

console.log(`Backing up local DB schema to ${schemaFile}`)
sh('npx', ['supabase@latest', 'db', 'dump', '--local', '--schema', 'public', '--file', schemaFile])

console.log(`Backing up local DB data to ${dataFile}`)
sh('npx', ['supabase@latest', 'db', 'dump', '--local', '--schema', 'public', '--data-only', '--file', dataFile])

console.log('Backup complete.')

