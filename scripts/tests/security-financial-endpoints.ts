#!/usr/bin/env -S npx tsx
/**
 * Quick regression check: endpoints should reject unauthenticated access.
 *
 * Requires a running app server (default http://localhost:3000) and env:
 *   TEST_PROPERTY_ID
 *   TEST_BANK_ACCOUNT_ID
 *
 * This test only asserts that unauthenticated requests return 401/403.
 */
import 'dotenv/config'

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
const propertyId = process.env.TEST_PROPERTY_ID
const bankAccountId = process.env.TEST_BANK_ACCOUNT_ID

if (!propertyId || !bankAccountId) {
  console.warn('Skipping security check: set TEST_PROPERTY_ID and TEST_BANK_ACCOUNT_ID to run.')
  process.exit(0)
}

async function expectUnauthorized(path: string) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })
  if (res.status === 401 || res.status === 403) {
    console.log(`✅ ${path} rejected unauthenticated request with ${res.status}`)
    return
  }
  console.error(`❌ ${path} expected 401/403, got ${res.status}`)
  process.exitCode = 1
}

async function main() {
  await expectUnauthorized(`/api/properties/${propertyId}/financials`)
  await expectUnauthorized(`/api/reconciliations/pending?propertyId=${propertyId}&bankAccountId=${bankAccountId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
