import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import { AppRole, RoleRank } from '@/lib/auth/roles'
import { mapUIStaffRoleToDB } from '@/lib/enums/staff-roles'

const ALLOWED_ROLES: AppRole[] = [
  'platform_admin',
  'org_admin',
  'org_manager',
  'org_staff',
  'owner_portal',
  'tenant_portal',
  'vendor_portal',
]

const InviteSchema = z.object({
  email: z.string().email('email must be a valid address'),
  org_id: z.string().min(1).optional(),
  roles: z.array(z.string()).optional(),
  permission_profile_id: z.string().uuid().optional(),
  staff_role: z.string().optional(),
})

function normalizeRole(value: string): AppRole | null {
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

// Invite a new user to the platform
// Body: { email: string, org_id?: string, roles?: string[] }
export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin')

    const body = await request.json().catch(() => ({}))
    const parsed = InviteSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues.map(i => i.message).join('\n') || 'Invalid payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const { email: rawEmail, org_id: rawOrgId, roles: rawRoles, permission_profile_id: _permission_profile_id, staff_role } = parsed.data

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured with service role' }, { status: 500 })
    }

    const email = rawEmail.trim().toLowerCase()
    const org_id = rawOrgId?.trim() || undefined
    const normalizedRoles = Array.from(
      new Set(
        (rawRoles ?? ['org_staff'])
          .map(normalizeRole)
          .filter((role): role is AppRole => role !== null)
      )
    )

    if (!normalizedRoles.length) {
      normalizedRoles.push('org_staff')
    }

    normalizedRoles.sort((a, b) => RoleRank[b] - RoleRank[a])
    const supabaseAdmin = requireSupabaseAdmin('admin invite user')

    // Check if user already exists
    type UserWithAuthRow = { user_id: string }
    const { data: existingUserRow, error: userError } = await (supabaseAdmin as any)
      .from('users_with_auth')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    if (userError && userError.code !== 'PGRST116') {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    const existingUser = (existingUserRow || null) as UserWithAuthRow | null
    let userId: string

    if (existingUser?.user_id) {
      // User exists, use their ID
      userId = existingUser.user_id
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm for admin invites
        user_metadata: {
          invited_by_admin: true
        }
      })

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      userId = newUser.user.id
    }

    // If org_id provided, create membership
    if (org_id) {
      const { error: membershipError } = await supabaseAdmin
        .from('org_memberships')
        .upsert({ user_id: userId, org_id }, { onConflict: 'user_id,org_id' })

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
      }

      // Persist all selected roles for the membership via membership_roles (roles table-backed)
      try {
        const { data: roleRows, error: rolesLookupError } = await supabaseAdmin
          .from('roles')
          .select('id, name, org_id')
          .in('name', normalizedRoles)
          .or(`org_id.eq.${org_id},org_id.is.null`)
          .order('org_id', { ascending: false })

        if (rolesLookupError) {
          console.warn('Failed to lookup roles for invite', rolesLookupError)
        } else {
          const roleMap = new Map<string, string>()
          for (const r of roleRows || []) {
            if (r?.name && r?.id && !roleMap.has(r.name)) {
              roleMap.set(r.name, r.id)
            }
          }

          await supabaseAdmin.from('membership_roles').delete().eq('user_id', userId).eq('org_id', org_id)
          const rowsToInsert = normalizedRoles
            .map((roleName) => {
              const roleId = roleMap.get(roleName)
              return roleId ? { user_id: userId, org_id, role_id: roleId } : null
            })
            .filter(Boolean) as { user_id: string; org_id: string; role_id: string }[]

          if (rowsToInsert.length) {
            const { error: rolesError } = await supabaseAdmin.from('membership_roles').insert(rowsToInsert)
            if (rolesError) console.warn('Failed to insert membership_roles for invite', rolesError)
          }
        }
      } catch (rolesException) {
        console.warn('Failed to sync membership_roles for invite', rolesException)
      }
    }

    // Auto-provision staff row when invited as staff/manager
    const isStaffish = normalizedRoles.includes('org_manager') || normalizedRoles.includes('org_staff') || !!staff_role
    if (isStaffish) {
      try {
        const { data: existingStaff } = await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()
        if (!existingStaff?.id) {
          const staffRole = staff_role
            ? mapUIStaffRoleToDB(staff_role)
            : normalizedRoles.includes('org_manager')
              ? mapUIStaffRoleToDB('Property Manager')
              : mapUIStaffRoleToDB('Bookkeeper')
          const timestamp = new Date().toISOString()
          await supabaseAdmin
            .from('staff')
            .insert({
              user_id: userId,
              role: staffRole,
              email,
              is_active: true,
              created_at: timestamp,
              updated_at: timestamp,
            })
        }
      } catch (staffError) {
        console.warn('Failed to auto-create staff row for invite', staffError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: userId,
        email: email,
        created: !existingUser?.user_id
      }
    })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = typeof error?.message === 'string' ? error.message : 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
