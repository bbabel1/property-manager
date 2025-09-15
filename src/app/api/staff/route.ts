import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { StaffQuerySchema } from '@/schemas/staff'
import { StaffCreateSchema } from '@/schemas/staff'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate(Object.fromEntries(searchParams), StaffQuerySchema);
    console.log('Staff API: Validated query parameters:', query);

    // Fetch staff from database with optional filters
    const isActive = (query as any)?.isActive
    const role = (query as any)?.role
    const client = supabaseAdmin || supabase
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
    if (role) q = q.eq('role', role)

    const { data: staff, error } = await q

    if (error) {
      console.error('Error fetching staff:', error)
      // If schema/columns are missing or table is absent, return an empty list for dev
      const msg = String(error.message || '')
      const code = (error as any).code
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
    const transformedStaff = (staff || []).map((member: any) => {
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
    const { firstName, lastName, email, phone, role, isActive, buildiumUserId } = {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      isActive: parsed.data.isActive ?? true,
      buildiumUserId: parsed.data.buildiumUserId ?? null
    }
    const orgIdOverride = (body?.orgId as string | undefined) || null
    const sendInvite = body?.sendInvite !== false

    // Determine default org: caller's first org membership when not provided
    let targetOrgId: string | null = orgIdOverride
    if (!targetOrgId && supabaseAdmin) {
      const { data: mem } = await supabaseAdmin.from('org_memberships').select('org_id').eq('user_id', reqUser.id).limit(1).maybeSingle()
      targetOrgId = (mem as any)?.org_id ?? null
    }

    // Create or invite auth user when email provided
    let staffUserId: string | null = null
    if (email) {
      if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Server not configured for user invites (service role missing)' }, { status: 501 })
      }
      // Try to locate existing auth user by email via users_with_auth view
      try {
        const { data: existing } = await supabaseAdmin
          .from('users_with_auth')
          .select('user_id')
          .eq('email', email)
          .maybeSingle()
        staffUserId = (existing as any)?.user_id ?? null
      } catch {}
      // If not found, invite or create
      if (!staffUserId) {
        try {
          if (sendInvite) {
            const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
            staffUserId = invite?.data?.user?.id ?? null
          } else {
            const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: false })
            staffUserId = created?.data?.user?.id ?? null
          }
        } catch (e: any) {
          // Re-check users_with_auth in case user now exists
          try {
            const { data: existing2 } = await supabaseAdmin
              .from('users_with_auth')
              .select('user_id')
              .eq('email', email)
              .maybeSingle()
            staffUserId = (existing2 as any)?.user_id ?? null
          } catch {}
          if (!staffUserId) return NextResponse.json({ error: 'Failed to create or invite user', details: e?.message || String(e) }, { status: 500 })
        }
      }
      // Upsert profile
      try {
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null
        await supabaseAdmin
          .from('profiles')
          .upsert({ user_id: staffUserId, full_name: fullName, email }, { onConflict: 'user_id' })
      } catch {}
    }

    // Insert staff
    const { data: staffRow, error } = await (supabaseAdmin || supabase)
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
    if (targetOrgId && staffUserId && (supabaseAdmin || supabase)) {
      const orgRole = role === 'PROPERTY_MANAGER' ? 'org_manager' : 'org_staff'
      await (supabaseAdmin || supabase)
        .from('org_memberships')
        .upsert({ user_id: staffUserId, org_id: targetOrgId, role: orgRole as any }, { onConflict: 'user_id,org_id' })
    }

    return NextResponse.json({ staff: staffRow })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
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
    const patch: any = {}
    if (body.role) patch.role = body.role
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive
    if (typeof body.firstName === 'string') patch.first_name = body.firstName || null
    if (typeof body.lastName === 'string') patch.last_name = body.lastName || null
    if (typeof body.email === 'string') patch.email = body.email || null
    if (typeof body.phone === 'string') patch.phone = body.phone || null
    if (typeof body.title === 'string') patch.title = body.title || null
    patch.updated_at = new Date().toISOString()
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    const { error } = await supabase.from('staff').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to update staff', details: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireUser(request)
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to delete staff', details: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
