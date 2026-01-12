#!/usr/bin/env tsx
/* eslint-disable no-console */

import dotenv from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

console.log('🔍 Listing Existing Owner Records\n')

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function log(message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') {
  const timestamp = new Date().toISOString()
  const prefix =
    type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'
  console.log(`${prefix} [${timestamp}] ${message}`)
}

async function listExistingOwners() {
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  log('Listing existing owner records...')

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)', 'error')
    process.exit(1)
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/owners?select=*`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    log(`Response Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      log(`Error: ${errorText}`, 'error')
      return
    }

    const owners = (await response.json()) as any[]

    if (owners.length > 0) {
      log(`Found ${owners.length} owner record(s):`, 'success')

      owners.forEach((owner, index) => {
        console.log(`\n📋 Owner ${index + 1}:`)
        console.log(`  ID: ${owner.id}`)
        console.log(`  Columns: ${Object.keys(owner).join(', ')}`)
        console.log('  Data:', JSON.stringify(owner, null, 2))
      })
    } else {
      log('No owner records found in the database', 'warning')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`Error listing owners: ${message}`, 'error')
  }
}

listExistingOwners()
  .then(() => {
    log('Owner listing completed', 'success')
    process.exit(0)
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    log(`Unexpected error: ${message}`, 'error')
    process.exit(1)
  })
