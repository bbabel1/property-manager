import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/guards'
import { AppRole, RoleRank } from '@/lib/auth/roles'
import type { Database } from '@/types/database'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { mapUIStaffRoleToDB } from '@/lib/enums/staff-roles'

const ROLE_SCHEMA = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  org_id: z.string().min(1, 'org_id is required'),
  roles: z.array(z.string().min(1)).min(1, 'At least one role is required'),
  staff_role: z.string().optional()
})

const ALLOWED_ROLES: AppRole[] = [
  'platform_admin',
  'org_admin',
  'org_manager',
  'org_staff',
  'owner_portal',
  'tenant_portal',
  'vendor_portal'
]

function normalizeAppRole(value: string): AppRole | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') as AppRole

  if (ALLOWED_ROLES.includes(normalized)) {
    return normalized
  }

  if (normalized === 'property_manager' || normalized === 'propertymanager') {
    return 'org_manager'
  }
  if (normalized === 'assistant_property_manager' || normalized === 'assistantpropertymanager') {
    return 'org_staff'
  }
  if (normalized === 'vendor_portal' || normalized === 'vendor') {
    return 'vendor_portal'
  }

  return null
}

// POST /api/admin/memberships
// Body: { user_id: string, org_id: string, roles: string[] }
export async function POST(request: NextRequest) {
  try {
    await requireRole('org_admin')
    const rawBody = await request.json().catch(() => ({}))
    const parsed = ROLE_SCHEMA.safeParse(rawBody)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('\n') || 'Invalid request payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const roles = Array.from(
      new Set(
        parsed.data.roles
          .map(normalizeAppRole)
          .filter((role): role is AppRole => role !== null)
      )
    )

    if (!roles.length) {
      return NextResponse.json({ error: 'No valid roles provided' }, { status: 400 })
    }

    roles.sort((a, b) => RoleRank[b] - RoleRank[a])
    const top = roles[0]

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = requireSupabaseAdmin('upsert membership roles')
    const membershipRow: Database['public']['Tables']['org_memberships']['Insert'] = {
      user_id: parsed.data.user_id,
      org_id: parsed.data.org_id,
      role: top
    }

    // Keep primary/top role for compatibility
    const { error: upsertMembershipError } = await admin
      .from('org_memberships')
      .upsert(membershipRow, { onConflict: 'user_id,org_id' })
    if (upsertMembershipError) {
      return NextResponse.json({ error: 'Failed to update roles', details: upsertMembershipError.message }, { status: 500 })
    }

    // Store the full set of roles
    try {
      await admin
        .from('org_membership_roles')
        .delete()
        .eq('user_id', parsed.data.user_id)
        .eq('org_id', parsed.data.org_id)

      const insertRoles = roles.map((role) => ({
        user_id: parsed.data.user_id,
        org_id: parsed.data.org_id,
        role
      }))

      const { error: insertError } = await admin
        .from('org_membership_roles')
        .insert(insertRoles)

      if (insertError) {
        console.warn('Failed to persist org_membership_roles; falling back to primary role only', insertError)
      }
    } catch (rolesError) {
      console.warn('Failed to update org_membership_roles', rolesError)
    }

    if (top === 'org_manager' || top === 'org_staff' || parsed.data.staff_role) {
      try {
        const staffRole = parsed.data.staff_role
          ? mapUIStaffRoleToDB(parsed.data.staff_role)
          : mapUIStaffRoleToDB(top === 'org_manager' ? 'Property Manager' : 'Bookkeeper')
        const timestamp = new Date().toISOString()
        const { data: existing } = await admin
          .from('staff')
          .select('id')
          .eq('user_id', parsed.data.user_id)
          .limit(1)

        if (!existing || existing.length === 0) {
          const staffInsert: Database['public']['Tables']['staff']['Insert'] = {
            role: staffRole,
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp
          }
          staffInsert.user_id = parsed.data.user_id
          await admin.from('staff').insert(staffInsert)
        }
      } catch (staffError) {
        console.warn('Failed to auto-provision staff for membership change', staffError)
      }
    }

    return NextResponse.json({ success: true, role: top })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (e?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
