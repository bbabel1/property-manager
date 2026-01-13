#!/usr/bin/env npx tsx
/**
 * Add a membership_role for a user/org combination.
 * Usage: npx tsx scripts/add-membership-role.ts [user_id] [org_id] [role_name]
 * 
 * Example:
 *   npx tsx scripts/add-membership-role.ts e4800813-a9ee-494a-a6a3-7f2d3cae6257 1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3 org_admin
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

  const supabase = createClient(url, serviceKey)

  // Get args: user_id, org_id, role_name (defaults to org_admin)
  const userId = process.argv[2] || 'e4800813-a9ee-494a-a6a3-7f2d3cae6257'
  const orgId = process.argv[3] || '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3'
  const roleName = process.argv[4] || 'org_admin'

  console.log(`Adding membership_role:`)
  console.log(`  User ID: ${userId}`)
  console.log(`  Org ID: ${orgId}`)
  console.log(`  Role: ${roleName}`)
  console.log()

  // 1. Find the role_id for the role name
  // Prefer org-specific roles, fallback to system roles (org_id is null)
  const { data: roleRows, error: roleError } = await supabase
    .from('roles')
    .select('id, name, org_id')
    .eq('name', roleName)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('org_id', { ascending: false })
    .limit(1)

  if (roleError) {
    throw new Error(`Failed to lookup role: ${roleError.message}`)
  }

  if (!roleRows || roleRows.length === 0) {
    throw new Error(`Role '${roleName}' not found (checked for org ${orgId} and system roles)`)
  }

  const roleId = roleRows[0].id
  console.log(`Found role_id: ${roleId} (name: ${roleRows[0].name}, org_id: ${roleRows[0].org_id || 'system'})`)
  console.log()

  // 2. Check if membership_role already exists
  const { data: existing, error: checkError } = await supabase
    .from('membership_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('role_id', roleId)
    .maybeSingle()

  if (checkError) {
    throw new Error(`Failed to check existing membership_role: ${checkError.message}`)
  }

  if (existing) {
    console.log('✅ Membership role already exists, no action needed.')
    console.log(`   Created at: ${existing.created_at}`)
    return
  }

  // 3. Insert the membership_role
  const { data: inserted, error: insertError } = await supabase
    .from('membership_roles')
    .insert({
      user_id: userId,
      org_id: orgId,
      role_id: roleId,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to insert membership_role: ${insertError.message}`)
  }

  console.log('✅ Successfully added membership_role!')
  console.log(`   Inserted row:`, inserted)
  console.log()
  console.log('⚠️  IMPORTANT: User must sign out and sign back in for JWT token to include org_ids.')
  console.log('   The jwt_custom_claims() function will populate org_ids from membership_roles on next token refresh.')
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})

