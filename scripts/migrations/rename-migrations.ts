#!/usr/bin/env -S node --loader tsx
import { readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const SQL_RE = /\.sql$/
const FILE_RE = /^(?<ts>\d{14})(?:_(?<seq>\d{3}))?_(?<desc>[a-z0-9_]+)\.sql$/
const LEGACY_RE = /^(?<num>\d{1,3})_(?<desc>.+)\.sql$/

type Entry = { orig: string; ts: string; desc: string }

function slugify(s: string): string {
  return s
    .replace(/\.sql$/i, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function pad(n: number, w: number) { return String(n).padStart(w, '0') }

function nextTs(base: string, offsetSeconds: number): string {
  const y = Number(base.slice(0,4)); const m = Number(base.slice(4,6)) - 1; const d = Number(base.slice(6,8))
  const H = Number(base.slice(8,10)); const M = Number(base.slice(10,12)); const S = Number(base.slice(12,14))
  const t = new Date(Date.UTC(y,m,d,H,M,S))
  const t2 = new Date(t.getTime() + offsetSeconds * 1000)
  const pp = (n:number)=>String(n).padStart(2,'0')
  return `${t2.getUTCFullYear()}${pp(t2.getUTCMonth()+1)}${pp(t2.getUTCDate())}${pp(t2.getUTCHours())}${pp(t2.getUTCMinutes())}${pp(t2.getUTCSeconds())}`
}

function main() {
  const args = new Set(process.argv.slice(2))
  const apply = args.has('--apply')
  const baseTs = process.env.MIGRATION_BASE_TS || '20240101000000'

  const files = readdirSync(MIGRATIONS_DIR).filter(f => SQL_RE.test(f) && !f.endsWith('.bak'))

  const entries: Entry[] = []
  const legacy: string[] = []

  for (const f of files) {
    const m = FILE_RE.exec(f)
    if (m && m.groups) {
      const ts = m.groups.ts
      const desc = slugify(m.groups.desc)
      entries.push({ orig: f, ts, desc })
      continue
    }
    const L = LEGACY_RE.exec(f)
    if (L && L.groups) {
      legacy.push(f)
      continue
    }
    console.warn(`Skipping non-standard file: ${f}`)
  }

  // Assign timestamps for legacy in current directory order
  legacy.sort()
  legacy.forEach((f, i) => {
    const L = LEGACY_RE.exec(f)!
    const desc = slugify(L.groups!.desc)
    const ts = nextTs(baseTs, i)
    entries.push({ orig: f, ts, desc })
  })

  // Sort by timestamp, then description
  entries.sort((a,b)=> a.ts.localeCompare(b.ts) || a.desc.localeCompare(b.desc))

  // Assign global 3-digit sequence
  const mapping: { from: string; to: string }[] = []
  entries.forEach((e, idx) => {
    const seq = pad(idx+1, 3)
    const to = `${e.ts}_${seq}_${e.desc}.sql`
    if (e.orig !== to) mapping.push({ from: e.orig, to })
  })

  if (!mapping.length) {
    console.log('All migration files already follow the convention.')
    return
  }

  console.log('Planned renames:')
  for (const m of mapping) console.log(`  ${m.from}  ->  ${m.to}`)

  if (!apply) {
    console.log('\nDry run. Pass --apply to rename files.')
    return
  }

  // Ensure no duplicates in targets
  const targets = new Set<string>()
  for (const m of mapping) {
    if (targets.has(m.to)) throw new Error(`Conflict: multiple files target ${m.to}`)
    targets.add(m.to)
  }

  for (const m of mapping) {
    renameSync(join(MIGRATIONS_DIR, m.from), join(MIGRATIONS_DIR, m.to))
    console.log(`Renamed ${m.from} -> ${m.to}`)
  }
}

main()

