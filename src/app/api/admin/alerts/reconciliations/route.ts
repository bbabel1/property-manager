import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'

export async function GET(req: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(req, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })

    const admin = supabaseAdmin ?? db
    if (!admin) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'variance' | 'stale' | null
    const table =
      type === 'variance'
        ? 'v_reconciliation_variance_alerts'
        : type === 'stale'
          ? 'v_reconciliation_stale_alerts'
          : 'v_reconciliation_alerts'

    // These views are not yet in the generated Supabase types; cast to avoid type instantiation blowups
    const { data, error } = await admin
      .from(table as unknown as 'v_reconciliation_variance_alerts')
      .select('*')
      .eq('org_id', orgId)
      .returns<Record<string, unknown>[]>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data, count: Array.isArray(data) ? data.length : 0 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      if (error.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
