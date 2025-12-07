import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import { AppRole, RoleRank } from '@/lib/auth/roles'
import { pickDefaultProfileNameForRoles } from '@/lib/permission-profiles'
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
    const { email: rawEmail, org_id: rawOrgId, roles: rawRoles, permission_profile_id, staff_role } = parsed.data

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
    const topRole = normalizedRoles[0]

    const supabaseAdmin = requireSupabaseAdmin('admin invite user')

    // Check if user already exists
    const { data: existingUserRow, error: userError } = await supabaseAdmin
      .from('users_with_auth')
      .select('user_id')
      .eq('email', email)
      .maybeSingle()

    if (userError && userError.code !== 'PGRST116') {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    let userId: string

    if (existingUserRow?.user_id) {
      // User exists, use their ID
      userId = existingUserRow.user_id
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
        .upsert(
          {
            user_id: userId,
            org_id,
            role: topRole
          },
          { onConflict: 'user_id,org_id' }
        )

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
      }

      // Persist all selected roles for the membership
      try {
        const { error: deleteError } = await supabaseAdmin
          .from('org_membership_roles')
          .delete()
          .eq('user_id', userId)
          .eq('org_id', org_id)

        if (deleteError) {
          console.warn('Failed to clear org_membership_roles before insert', deleteError)
        }

        const roleRows = normalizedRoles.map((role) => ({ user_id: userId, org_id, role }))
        const { error: rolesError } = await supabaseAdmin
          .from('org_membership_roles')
          .insert(roleRows)

        if (rolesError) {
          console.warn('Failed to insert org_membership_roles for invite', rolesError)
        }
      } catch (rolesException) {
        console.warn('Failed to sync org_membership_roles for invite', rolesException)
      }

      // Assign permission profile when provided or using default for role set
      const profileName = permission_profile_id ? null : pickDefaultProfileNameForRoles(normalizedRoles)
      try {
        await supabaseAdmin
          .from('user_permission_profiles')
          .delete()
          .eq('user_id', userId)
          .eq('org_id', org_id)
        if (permission_profile_id) {
          await supabaseAdmin
            .from('user_permission_profiles')
            .insert({ user_id: userId, org_id, profile_id: permission_profile_id })
        } else if (profileName) {
          const { data: profileRow } = await supabaseAdmin
            .from('permission_profiles')
            .select('id')
            .eq('name', profileName)
            .or(`org_id.is.null,org_id.eq.${org_id}`)
            .order('org_id', { ascending: false })
            .limit(1)
            .maybeSingle()
          const profileId = (profileRow as any)?.id
          if (profileId) {
            await supabaseAdmin
              .from('user_permission_profiles')
              .insert({ user_id: userId, org_id, profile_id: profileId })
          }
        }
      } catch (profileError) {
        console.warn('Failed to assign permission profile on invite', profileError)
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
        created: !existingUserRow?.user_id
      }
    })
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
