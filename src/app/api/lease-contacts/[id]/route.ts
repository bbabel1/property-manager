import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'

type Params = Promise<{ id: string }>

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })
    const { id } = await params
    const rawBody = await request.json().catch<unknown>(() => ({}))
    const body =
      rawBody && typeof rawBody === 'object'
        ? (rawBody as Partial<{ move_in_date: string | null }>)
        : {}
    const patch: { move_in_date?: string | null; updated_at?: string } = {}
    if ('move_in_date' in body) patch.move_in_date = body.move_in_date ?? null
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }
    patch.updated_at = new Date().toISOString()

    const { data: contact } = await db
      .from('lease_contacts')
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await db
      .from('lease_contacts')
      .update(patch)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, move_in_date')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, contact: data })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      if (error.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(_request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })
    const { id } = await params
    const { data: contact } = await db
      .from('lease_contacts')
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { error } = await db.from('lease_contacts').delete().eq('id', id).eq('org_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      if (error.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
