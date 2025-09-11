#!/usr/bin/env -S tsx
// Quick Buildium API smoke tests using clientId/clientSecret headers
// Usage: npm run test:buildium:smoke

import 'dotenv/config'

type TestResult = { name: string; ok: boolean; status?: number; error?: string }

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} in environment`)
  return v
}

async function hit(base: string, clientId: string, clientSecret: string, path: string): Promise<TestResult> {
  const url = `${base}${path}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
      },
    })
    const text = await res.text()
    return { name: `GET ${path}`, ok: res.ok, status: res.status, error: res.ok ? undefined : text.slice(0, 300) }
  } catch (e) {
    return { name: `GET ${path}`, ok: false, error: (e as Error).message }
  }
}

async function main() {
  const base = requireEnv('BUILDIUM_BASE_URL')
  const clientId = requireEnv('BUILDIUM_CLIENT_ID')
  const clientSecret = requireEnv('BUILDIUM_CLIENT_SECRET')

  const tests: Array<Promise<TestResult>> = []
  // Core endpoints aligned with quick reference (no query params)
  tests.push(hit(base, clientId, clientSecret, '/rentals'))
  tests.push(hit(base, clientId, clientSecret, '/rentals/units'))
  tests.push(hit(base, clientId, clientSecret, '/leases'))
  tests.push(hit(base, clientId, clientSecret, '/rentals/owners'))

  const results = await Promise.all(tests)
  const summary = {
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
  }

  for (const r of results) {
    const badge = r.ok ? '✅' : '❌'
    console.log(`${badge} ${r.name}${r.status ? ` -> ${r.status}` : ''}${r.error ? ` | ${r.error}` : ''}`)
  }
  console.log(`\nSummary: ${summary.passed}/${summary.total} passed`)

  if (summary.failed) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
