import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { buildiumFetch } from '@/lib/buildium-http'
import { mapStaffToBuildium } from '@/lib/buildium-mappers'
import type { Database } from '@/types/database'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'

type StaffUpdate = Database['public']['Tables']['staff']['Update']

export async function POST(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireRole('platform_admin')
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })
    const body = await request.json().catch(() => ({})) as { staff_id?: number | string }
    const sidRaw = body?.staff_id
    if (!sidRaw) return NextResponse.json({ error: 'staff_id is required' }, { status: 400 })
    const staffId = typeof sidRaw === 'string' ? Number(sidRaw) : sidRaw
    if (!Number.isFinite(staffId)) return NextResponse.json({ error: 'Invalid staff_id' }, { status: 400 })

    const { data: st, error: err } = await db
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .maybeSingle()
    if (err || !st) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const payload = mapStaffToBuildium(st)

    // Use Buildium Users endpoint: POST /v1/users (create) or PUT /v1/users/{id} (update)
    const localBuildiumId = typeof st.buildium_user_id === 'number' ? st.buildium_user_id : null
    const isUpdate = typeof localBuildiumId === 'number' && Number.isFinite(localBuildiumId)
    const path = isUpdate ? `/users/${localBuildiumId}` : '/users'
    const method = isUpdate ? 'PUT' : 'POST'

    const res = await buildiumFetch(method, path, undefined, payload, orgId)

    if (!res.ok) {
      const details: unknown = res.json ?? null
      return NextResponse.json({ error: 'Buildium staff sync failed', status: res.status, endpoint: path, method, details }, { status: 502 })
    }

    const data = (res.json ?? {}) as Record<string, unknown>
    const buildiumId: number | null = typeof (data as { Id?: unknown })?.Id === 'number' ? (data as { Id: number }).Id : null
    if (buildiumId) {
      const updatePayload: StaffUpdate = { buildium_user_id: buildiumId }
      await db.from('staff').update(updatePayload).eq('id', staffId)
    }

    return NextResponse.json({ success: true, buildiumId, data })
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      if (e.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      if (e.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
