
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth()
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('idempotencyKey')
    if (!key) return NextResponse.json({ error: 'idempotencyKey required' }, { status: 400 })

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase)

    const { data, error } = await supabase
      .from('idempotency_keys')
      .select('response, created_at')
      .eq('key', key)
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ status: 'not_found' }, { status: 404 })
    return NextResponse.json({
      status: 'found',
      status_code: 201,
      response: data.response,
      created_at: data.created_at,
    })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      if (err.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      if (err.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
