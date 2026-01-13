#!/usr/bin/env npx tsx
/**
 * Check token claims for a user (requires service role to fetch user data)
 * This script checks what claims are in the user's app_metadata
 * 
 * Note: To check the actual JWT token, you need to decode it in the browser:
 * 1. Open browser devtools console
 * 2. Run: JSON.parse(atob((await supabase.auth.getSession()).data.session?.access_token.split('.')[1] || '{}'))
 * 
 * Or visit a page and check the x-auth-user header in Network tab
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const userId = process.argv[2] || 'e4800813-a9ee-494a-a6a3-7f2d3cae6257'

  console.log(`Checking user data for: ${userId}\n`)

  // Fetch user from auth.users (requires admin client)
  const { data: user, error } = await supabase.auth.admin.getUserById(userId)

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`)
  }

  if (!user.user) {
    throw new Error('User not found')
  }

  console.log('=== USER METADATA ===')
  console.log('app_metadata:', JSON.stringify(user.user.app_metadata, null, 2))
  console.log()
  console.log('user_metadata:', JSON.stringify(user.user.user_metadata, null, 2))
  console.log()

  // Check for org_ids in claims
  const claims = user.user.app_metadata?.claims as Record<string, unknown> | undefined
  const orgIds = claims?.org_ids as string[] | undefined

  console.log('=== TOKEN CLAIMS CHECK ===')
  if (orgIds && Array.isArray(orgIds) && orgIds.length > 0) {
    console.log('✅ org_ids found in claims:', orgIds)
  } else {
    console.log('❌ org_ids NOT found in app_metadata.claims')
    console.log('   This is expected if the user has not signed out/in after adding membership_role')
    console.log('   The jwt_custom_claims() function will populate org_ids when a new token is issued')
  }
  console.log()

  // Check membership_roles
  const { data: memberships, error: memError } = await supabase
    .from('membership_roles')
    .select('org_id, role_id, roles(name)')
    .eq('user_id', userId)

  if (!memError && memberships) {
    console.log('=== MEMBERSHIP ROLES ===')
    console.log(`Found ${memberships.length} membership(s):`)
    for (const m of memberships) {
      const roleName = (m.roles as { name?: string } | null)?.name || 'unknown'
      console.log(`  - Org: ${m.org_id}, Role: ${roleName}`)
    }
    console.log()
  }

  console.log('=== NEXT STEPS ===')
  console.log('To check the actual JWT token (in browser console):')
  console.log('  1. Sign out and sign back in to get a fresh token')
  console.log('  2. In browser devtools console, run:')
  console.log('     const { data } = await supabase.auth.getSession()')
  console.log('     const payload = JSON.parse(atob(data.session?.access_token.split(".")[1] || "{}"))')
  console.log('     console.log("Claims:", payload)')
  console.log('     console.log("org_ids:", payload.org_ids)')
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})

