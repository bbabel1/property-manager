import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { StaffQuerySchema } from '@/schemas/staff'
import { StaffCreateSchema } from '@/schemas/staff'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate(Object.fromEntries(searchParams), StaffQuerySchema);
    console.log('Staff API: Validated query parameters:', query);

    // Fetch staff from database
    const { data: staff, error } = await supabase
      .from('staff')
      .select(`
        id,
        role,
        is_active,
        created_at,
        updated_at,
        buildium_user_id
      `)
      .eq('is_active', true)
      .order('id', { ascending: true })

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

    // Transform data to include display name
    const transformedStaff = staff?.map(member => ({
      ...member,
      displayName: `Staff ${member.id}`
    })) || []

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
    await requireUser(request)
    const body = await request.json().catch(() => ({}))
    const parsed = StaffCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i=>i.message).join(', ') }, { status: 400 })
    }
    const { role, isActive, buildiumUserId } = {
      role: parsed.data.role,
      isActive: parsed.data.isActive ?? true,
      buildiumUserId: parsed.data.buildiumUserId ?? null
    }
    // Minimal insert to match columns used by GET
    const { data, error } = await supabase
      .from('staff')
      .insert({ role, is_active: isActive, buildium_user_id: buildiumUserId })
      .select('id, role, is_active, buildium_user_id')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to create staff', details: error.message }, { status: 500 })
    return NextResponse.json({ staff: data })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json().catch(() => ({})) as { id?: number; role?: string; isActive?: boolean }
    const id = body.id
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const patch: any = {}
    if (body.role) patch.role = body.role
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive
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
