#!/usr/bin/env -S node --loader tsx
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'

function nowTs(): string {
  const d = new Date()
  const pp = (n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}${pp(d.getMonth()+1)}${pp(d.getDate())}${pp(d.getHours())}${pp(d.getMinutes())}${pp(d.getSeconds())}`
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function pad(n: number, w: number) { return String(n).padStart(w, '0') }

function main() {
  const desc = process.argv.slice(2).join(' ').trim()
  if (!desc) {
    console.error('Usage: npm run db:migration:new -- <description>')
    process.exit(1)
  }
  const slug = slugify(desc)
  const ts = nowTs()
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
  // Global next sequence
  const seq = pad(files.length + 1, 3)
  const filename = `${ts}_${seq}_${slug}.sql`
  const path = join(MIGRATIONS_DIR, filename)
  writeFileSync(path, '-- Write your migration here\n')
  console.log('Created', path)
}

main()

