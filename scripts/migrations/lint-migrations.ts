#!/usr/bin/env -S node --import tsx
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

type Issue = { file: string; message: string }

const MIGRATIONS_DIR = 'supabase/migrations'
const MAX_FUTURE_YEARS = 3
const LARGE_TABLES = new Set([
  'transactions',
  'transaction_lines',
  'transaction_amounts',
  'bank_register_transactions',
  'bank_register_state',
  'payment_intents',
  'payment_lifecycle_events',
  'payments',
  'bills',
  'bill_overlay',
  'charge_schedules',
  'reconciliation_log',
])

const FILE_RE = /^(?<ts>\d{14})_(?<rest>.+)\.sql$/i
const DDL_ENFORCEMENT_FLOOR = '20270201030000' // apply DDL linting to new migrations only

function toIssues(): Issue[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.sql.bak'))
    .sort()

  const issues: Issue[] = []
  const seenTs = new Set<string>()
  const now = new Date()
  const maxYear = now.getUTCFullYear() + MAX_FUTURE_YEARS

  for (const file of files) {
    const match = FILE_RE.exec(file)
    if (!match || !match.groups) {
      issues.push({ file, message: 'Filename must be YYYYMMDDHHMMSS_description.sql' })
      continue
    }

    const ts = match.groups.ts
    if (seenTs.has(ts)) {
      issues.push({ file, message: `Duplicate timestamp ${ts}` })
    } else {
      seenTs.add(ts)
    }

    const year = Number(ts.slice(0, 4))
    if (year > maxYear) {
      issues.push({
        file,
        message: `Timestamp year ${year} is more than ${MAX_FUTURE_YEARS} years in the future`,
      })
    }

    const enforceDdl = ts >= DDL_ENFORCEMENT_FLOOR
    issues.push(...scanSql(file, enforceDdl))
  }

  return issues
}

function scanSql(file: string, enforceDdl: boolean): Issue[] {
  if (!enforceDdl) return []

  const path = join(MIGRATIONS_DIR, file)
  const sql = readFileSync(path, 'utf8')
  const issues: Issue[] = []

  const lines = sql.split(/\r?\n/)

  let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()

    if (inBlockComment) {
      if (lower.includes('*/')) inBlockComment = false
      continue
    }
    if (lower.trim().startsWith('--')) continue
    if (lower.includes('/*')) {
      inBlockComment = !lower.includes('*/')
      continue
    }

    const allowDrop = lower.includes('lint:allow-drop')
    const allowNotNull = lower.includes('lint:allow-not-null')
    const allowNonConcurrent = lower.includes('lint:allow-nonconcurrent')

    if (!allowDrop && /\bdrop\s+(table|column|schema)\b/.test(lower)) {
      issues.push({ file, message: `Line ${i + 1}: destructive DROP without lint:allow-drop` })
    }

    const addNotNull = /alter\s+table[^;]*add\s+column[^;]*not\s+null/.test(lower)
    const setNotNull = /alter\s+table[^;]*alter\s+column[^;]*set\s+not\s+null/.test(lower)
    if ((addNotNull || setNotNull) && !allowNotNull) {
      issues.push({ file, message: `Line ${i + 1}: NOT NULL change without expand/contract plan (add lint:allow-not-null)` })
    }

    const idxMatch = /create\s+(unique\s+)?index(?![^;]*concurrently)[^;]*\bon\s+([a-z0-9_."]+)/i.exec(line)
    if (idxMatch && !allowNonConcurrent) {
      const rawTable = idxMatch[2].replace(/["]/g, '')
      const table = rawTable.includes('.') ? rawTable.split('.').pop()! : rawTable
      if (LARGE_TABLES.has(table.toLowerCase())) {
        issues.push({
          file,
          message: `Line ${i + 1}: index on ${table} should use CONCURRENTLY or lint:allow-nonconcurrent`,
        })
      }
    }
  }

  return issues
}

function main() {
  const issues = toIssues()
  if (issues.length === 0) {
    console.log('✅ Migrations look clean: filenames normalized, ordering unique, and no risky DDL found.')
    return
  }

  console.error('❌ Migration lint failed:')
  for (const issue of issues) {
    console.error(`- ${issue.file}: ${issue.message}`)
  }
  process.exit(1)
}

main()
