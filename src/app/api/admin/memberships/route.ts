import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/types/database'
import { getServerSupabaseClient, hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { mapUIStaffRoleToDB } from '@/lib/enums/staff-roles'

// TODO: app_role enum doesn't exist in current database schema
// type AppRole = Database['public']['Enums']['app_role']

// const ORG_ROLE_RANK: Record<AppRole, number> = {
//   platform_admin: 100,
//   org_admin: 80,
//   org_manager: 60,
//   org_staff: 40,
//   owner_portal: 20,
//   tenant_portal: 10
// }

const ROLE_SCHEMA = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  org_id: z.string().min(1, 'org_id is required'),
  roles: z.array(z.string().min(1)).min(1, 'At least one role is required')
})

// TODO: Fix this function when app_role enum is available
// function normalizeAppRole(value: string): AppRole | null {
//   const normalized = value
//     .trim()
//     .toLowerCase()
//     .replace(/[^a-z0-9]+/g, '_')
//     .replace(/^_+|_+$/g, '')
//   if ((Object.keys(ORG_ROLE_RANK) as AppRole[]).includes(normalized as AppRole)) {
//     return normalized as AppRole
//   }
//   if (normalized === 'property_manager' || normalized === 'propertymanager') {
//     return 'org_manager'
//   }
//   if (normalized === 'assistant_property_manager' || normalized === 'assistantpropertymanager') {
//     return 'org_staff'
//   }
//   return null
// }

// POST /api/admin/memberships
// Body: { user_id: string, org_id: string, roles: string[] }
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const rawBody = await request.json().catch(() => ({}))
    const parsed = ROLE_SCHEMA.safeParse(rawBody)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('\n') || 'Invalid request payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // TODO: Fix when app_role enum is available
    // const roles = parsed.data.roles
    //   .map(normalizeAppRole)
    //   .filter((role): role is AppRole => role !== null)

    // if (!roles.length) {
    //   return NextResponse.json({ error: 'No valid roles provided' }, { status: 400 })
    // }

    // roles.sort((a, b) => ORG_ROLE_RANK[b] - ORG_ROLE_RANK[a])
    // const top = roles[0]
    
    return NextResponse.json({ error: 'Admin memberships API temporarily disabled - app_role enum missing' }, { status: 501 })

    // TODO: Uncomment when app_role enum is available
    // const db = getServerSupabaseClient()
    // const membershipRow: Database['public']['Tables']['org_memberships']['Insert'] = {
    //   user_id: parsed.data.user_id,
    //   org_id: parsed.data.org_id,
    //   role: top
    // }

    // TODO: Uncomment when app_role enum is available
    // const { error } = await db
    //   .from('org_memberships')
    //   .upsert(membershipRow, { onConflict: 'user_id,org_id' })
    // if (error) {
    //   return NextResponse.json({ error: 'Failed to update roles', details: error.message }, { status: 500 })
    // }

    // if (top === 'org_manager' && hasSupabaseAdmin()) {
    //   try {
    //     const admin = requireSupabaseAdmin('auto-provision staff for org_manager')
    //     const staffRole = mapUIStaffRoleToDB('Property Manager')
    //     const { data: existing } = await admin
    //       .from('staff')
    //       .select('id')
    //       .eq('role', staffRole)
    //       .eq('is_active', true)
    //       .limit(1)

    //     if (!existing || existing.length === 0) {
    //       const timestamp = new Date().toISOString()
    //       const staffInsert: Database['public']['Tables']['staff']['Insert'] = {
    //         role: staffRole,
    //         is_active: true,
    //         created_at: timestamp,
    //         updated_at: timestamp
    //       }
    //       await admin.from('staff').insert(staffInsert)
    //     }
    //   } catch (staffError) {
    //     console.warn('Failed to auto-provision staff for org_manager role', staffError)
    //   }
    // }

    // return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
