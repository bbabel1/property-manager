import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { sanitizeAndValidate } from '@/lib/sanitize'
import type { Database } from '@/types/database'
import { StaffQuerySchema } from '@/schemas/staff'
import { StaffCreateSchema } from '@/schemas/staff'
import {
  getServerSupabaseClient,
  hasSupabaseAdmin,
  requireSupabaseAdmin,
  SupabaseAdminUnavailableError,
} from '@/lib/supabase-client'
import { mapUIStaffRoleToDB } from '@/lib/enums/staff-roles'

type StaffRow = Database['public']['Tables']['staff']['Row']

interface StaffQueryParams {
  isActive?: boolean
  role?: string
}

export async function GET(request: NextRequest) {
  try {
    const _user = await requireUser(request)

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate(Object.fromEntries(searchParams), StaffQuerySchema);
    console.log('Staff API: Validated query parameters:', query);

    // Fetch staff from database with optional filters
    const { isActive, role } = query as StaffQueryParams
    const client = getServerSupabaseClient()
    let q = client
      .from('staff')
      .select(`
        id,
        role,
        is_active,
        created_at,
        updated_at,
        buildium_user_id,
        buildium_staff_id,
        first_name,
        last_name,
        email,
        phone
      `)
      .order('id', { ascending: true })

    if (typeof isActive === 'boolean') {
      q = q.eq('is_active', isActive)
    } else {
      q = q.eq('is_active', true)
    }
    if (role) {
      const dbRole = mapUIStaffRoleToDB(role)
      if (dbRole) {
        q = q.eq('role', dbRole)
      }
    }

    const { data: staff, error } = await q

    if (error) {
      console.error('Error fetching staff:', error)
      // If schema/columns are missing or table is absent, return an empty list for dev
      const msg = String(error.message || '')
      const code = (error as { code?: string }).code
      if (code === '42703' || msg.includes('does not exist') || msg.includes('Could not find the table')) {
        console.log('Staff schema incomplete or table missing, returning empty array')
        return NextResponse.json([])
      }
      return NextResponse.json(
        { error: 'Failed to fetch staff', details: error.message },
        { status: 500 }
      )
    }

    // Transform data to include friendly display name
    const transformedStaff = (staff || []).map((member) => {
      const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
      const displayName = name || member.email || `Staff ${member.id}`
      return { ...member, displayName }
    })

    return NextResponse.json(transformedStaff)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.error('Error in staff GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const reqUser = await requireUser(request)
    const body = await request.json().catch(() => ({}))
    const parsed = StaffCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i=>i.message).join(', ') }, { status: 400 })
    }
    const { firstName, lastName, email, phone, role: rawRole, isActive, buildiumUserId } = {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      isActive: parsed.data.isActive ?? true,
      buildiumUserId: parsed.data.buildiumUserId ?? null
    }
    const role = mapUIStaffRoleToDB(rawRole)
    const orgIdOverride = (body?.orgId as string | undefined) || null
    const sendInvite = body?.sendInvite !== false

    // Determine default org: caller's first org membership when not provided
    let targetOrgId: string | null = orgIdOverride
    if (!targetOrgId && hasSupabaseAdmin()) {
      const admin = requireSupabaseAdmin('staff POST org membership lookup')
      const { data: mem } = await admin
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', reqUser.id)
        .limit(1)
        .maybeSingle()
      targetOrgId = (mem as { org_id?: string })?.org_id ?? null
    }

    // Create or invite auth user when email provided
    let staffUserId: string | null = null
    const serverClient = getServerSupabaseClient()

    if (email) {
      if (!hasSupabaseAdmin()) {
        return NextResponse.json(
          { error: 'Server not configured for user invites (service role missing)' },
          { status: 501 }
        )
      }
      const admin = requireSupabaseAdmin('staff POST invite handler')
      // Try to locate existing auth user by email via users_with_auth view
      try {
        const { data: existing } = await admin
          .from('users_with_auth')
          .select('user_id')
          .eq('email', email)
          .maybeSingle()
        staffUserId = (existing as { user_id?: string })?.user_id ?? null
      } catch {}
      // If not found, invite or create
      if (!staffUserId) {
        try {
          if (sendInvite) {
            const invite = await admin.auth.admin.inviteUserByEmail(email)
            staffUserId = invite?.data?.user?.id ?? null
          } else {
            const created = await admin.auth.admin.createUser({ email, email_confirm: false })
            staffUserId = created?.data?.user?.id ?? null
          }
        } catch (e) {
          // Re-check users_with_auth in case user now exists
          try {
            const { data: existing2 } = await admin
              .from('users_with_auth')
              .select('user_id')
              .eq('email', email)
              .maybeSingle()
            staffUserId = (existing2 as { user_id?: string })?.user_id ?? null
          } catch {}
          if (!staffUserId) return NextResponse.json({ error: 'Failed to create or invite user', details: (e as Error)?.message || String(e) }, { status: 500 })
        }
      }
      if (staffUserId) {
        // Upsert profile when we have an auth user identifier
        try {
          const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null
          const profilePayload = {
            user_id: staffUserId,
            full_name: fullName,
            email
          } satisfies Database['public']['Tables']['profiles']['Insert']
          await admin
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'user_id' })
        } catch {}
      }
    }

    // Insert staff
    const { data: staffRow, error } = await serverClient
      .from('staff')
      .insert({
        user_id: staffUserId,
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
        phone: phone || null,
        title: body?.title || null,
        role,
        is_active: isActive,
        buildium_staff_id: buildiumUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to create staff', details: error.message }, { status: 500 })

    // Add org membership for the staff's user when we have an org context and user
    if (targetOrgId && staffUserId) {
      const orgRole = rawRole === 'Property Manager' ? 'org_manager' : 'org_staff'
      await serverClient
        .from('org_memberships')
        .upsert({ user_id: staffUserId, org_id: targetOrgId, role: orgRole }, { onConflict: 'user_id,org_id' })
    }

    return NextResponse.json({ staff: staffRow })
  } catch (e) {
    if (e instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 501 })
    }
    if ((e as Error)?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json().catch(() => ({})) as {
      id?: number
      role?: string
      isActive?: boolean
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      title?: string
    }
    const id = body.id
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const patch: Partial<StaffRow> = {}
    if (body.role) {
      const dbRole = mapUIStaffRoleToDB(body.role)
      if (!dbRole) {
        return NextResponse.json({ error: 'Invalid role provided' }, { status: 400 })
      }
      patch.role = dbRole
    }
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive
    if (typeof body.firstName === 'string') patch.first_name = body.firstName || null
    if (typeof body.lastName === 'string') patch.last_name = body.lastName || null
    if (typeof body.email === 'string') patch.email = body.email || null
    if (typeof body.phone === 'string') patch.phone = body.phone || null
    if (typeof body.title === 'string') patch.title = body.title || null
    patch.updated_at = new Date().toISOString()
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    const serverClient = getServerSupabaseClient()
    const { error } = await serverClient.from('staff').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to update staff', details: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if ((e as Error)?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireUser(request)
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const client = getServerSupabaseClient()
    const { error } = await client.from('staff').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to delete staff', details: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if ((e as Error)?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
