import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/guards'
import { AppRole, RoleRank } from '@/lib/auth/roles'
import type { Database } from '@/types/database'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { mapUIStaffRoleToDB } from '@/lib/enums/staff-roles'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateMembershipChange } from '@/lib/auth/membership-authz'

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
  const normalizedRaw = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const normalized = normalizedRaw as AppRole

  if (ALLOWED_ROLES.includes(normalized)) {
    return normalized
  }

  if (normalizedRaw === 'property_manager' || normalizedRaw === 'propertymanager') {
    return 'org_manager'
  }
  if (normalizedRaw === 'assistant_property_manager' || normalizedRaw === 'assistantpropertymanager') {
    return 'org_staff'
  }
  if (normalizedRaw === 'vendor_portal' || normalizedRaw === 'vendor') {
    return 'vendor_portal'
  }

  return null
}

// POST /api/admin/memberships
// Body: { user_id: string, org_id: string, roles: string[] }
export async function POST(request: NextRequest) {
  try {
    if (process.env.DISABLE_MEMBERSHIP_APIS === 'true') {
      return NextResponse.json({ error: 'Membership maintenance in progress' }, { status: 503 })
    }

    const rateLimit = await checkRateLimit(request, 'api')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 },
      )
    }

    const { supabase, user, roles: callerRoles } = await requireRole('org_admin')
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

    // Caller must be admin in the target org
    const targetOrgId = parsed.data.org_id
    const { data: callerRolesRows, error: membershipError } = await supabase
      .from('membership_roles')
      .select('roles(name)')
      .eq('user_id', user.id)
      .eq('org_id', targetOrgId)
    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }
    type CallerRoleRow = { roles?: { name?: string | null } | null }
    const callerOrgRole = ((callerRolesRows as CallerRoleRow[] | null) || [])
      .map((r) => (typeof r?.roles?.name === 'string' ? r.roles.name : null))
      .filter((role): role is AppRole => role !== null)?.[0] ?? null
    const validation = validateMembershipChange({
      callerOrgRole,
      callerGlobalRoles: callerRoles,
      requestedRoles: roles,
    })
    if (!validation.ok) {
      const message =
        validation.reason === 'platform_admin_required'
          ? 'Only platform_admin can grant platform_admin'
          : validation.reason === 'no_roles_provided'
            ? 'No valid roles provided'
            : 'Not authorized for this organization'
      const status = validation.reason === 'no_roles_provided' ? 400 : 403
      return NextResponse.json({ error: message }, { status })
    }

    roles.sort((a, b) => RoleRank[b] - RoleRank[a])
    const top = roles[0]

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = requireSupabaseAdmin('upsert membership roles')
    const membershipRow: Database['public']['Tables']['org_memberships']['Insert'] = {
      user_id: parsed.data.user_id,
      org_id: parsed.data.org_id
    }

    const { error: upsertMembershipError } = await admin
      .from('org_memberships')
      .upsert(membershipRow, { onConflict: 'user_id,org_id' })
    if (upsertMembershipError) {
      return NextResponse.json({ error: 'Failed to update roles', details: upsertMembershipError.message }, { status: 500 })
    }

    // Store the full set of roles via membership_roles (resolving role_id)
    try {
      const { data: roleRows, error: rolesLookupError } = await admin
        .from('roles')
        .select('id, name, org_id')
        .in('name', roles)
        .or(`org_id.eq.${parsed.data.org_id},org_id.is.null`)
        .order('org_id', { ascending: false })

      if (rolesLookupError) {
        console.warn('Failed to lookup roles', rolesLookupError)
      } else {
        const roleMap = new Map<string, string>()
        for (const r of roleRows || []) {
          if (r?.name && r?.id && !roleMap.has(r.name)) {
            roleMap.set(r.name, r.id)
          }
        }

        await admin
          .from('membership_roles')
          .delete()
          .eq('user_id', parsed.data.user_id)
          .eq('org_id', parsed.data.org_id)

        const insertRoles = roles
          .map((roleName) => {
            const roleId = roleMap.get(roleName)
            return roleId ? { user_id: parsed.data.user_id, org_id: parsed.data.org_id, role_id: roleId } : null
          })
          .filter(Boolean) as { user_id: string; org_id: string; role_id: string }[]

        if (insertRoles.length) {
          const { error: insertError } = await admin.from('membership_roles').insert(insertRoles)
          if (insertError) {
            console.warn('Failed to persist membership_roles; roles not fully saved', insertError)
          }
        }
      }
    } catch (rolesError) {
      console.warn('Failed to update membership_roles', rolesError)
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : null
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
