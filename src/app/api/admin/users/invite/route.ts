import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'

// Invite a new user to the platform
// Body: { email: string, org_id?: string, roles?: string[] }
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server not configured with service role' }, { status: 500 })
    }

    const email = String(body.email).trim().toLowerCase()
    const org_id = typeof body.org_id === 'string' && body.org_id.trim().length > 0 ? body.org_id : undefined
    const roles: string[] = Array.isArray(body.roles)
      ? body.roles.map((role: unknown) => String(role)).filter(Boolean)
      : ['org_staff']

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

    // If org_id and roles are provided, create memberships
    type MembershipRole = 'platform_admin' | 'org_admin' | 'org_manager' | 'org_staff' | 'owner_portal' | 'tenant_portal'
    const allowedRoles: MembershipRole[] = ['platform_admin', 'org_admin', 'org_manager', 'org_staff', 'owner_portal', 'tenant_portal']
    const normalizedRoles = (roles.length > 0 ? roles : ['org_staff'])
      .filter((role): role is MembershipRole => allowedRoles.includes(role as MembershipRole))

    if (org_id && normalizedRoles.length > 0) {
      const memberships = normalizedRoles.map(role => ({
        user_id: userId,
        org_id: org_id,
        role: role
      }))

      const { error: membershipError } = await supabaseAdmin
        .from('org_memberships')
        .insert(memberships)

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
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
