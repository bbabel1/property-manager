import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { supabase, supabaseAdmin } from '@/lib/db'
import { mapStaffToBuildium } from '@/lib/buildium-mappers'
import type { Database } from '@/types/database'

type StaffUpdate = Database['public']['Tables']['staff']['Update']

export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin')
    const body = await request.json().catch(() => ({})) as { staff_id?: number | string }
    const sidRaw = body?.staff_id
    if (!sidRaw) return NextResponse.json({ error: 'staff_id is required' }, { status: 400 })
    const staffId = typeof sidRaw === 'string' ? Number(sidRaw) : sidRaw
    if (!Number.isFinite(staffId)) return NextResponse.json({ error: 'Invalid staff_id' }, { status: 400 })

    const db = supabaseAdmin || supabase
    const { data: st, error: err } = await db
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .maybeSingle()
    if (err || !st) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const payload = mapStaffToBuildium(st)

    // Ensure Buildium credentials are present
    const base = process.env.BUILDIUM_BASE_URL
    const clientId = process.env.BUILDIUM_CLIENT_ID
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET
    if (!base || !clientId || !clientSecret) {
      return NextResponse.json({ error: 'Buildium not configured' }, { status: 501 })
    }

    // Use Buildium Users endpoint: POST /v1/users (create) or PUT /v1/users/{id} (update)
    const localBuildiumId = typeof st.buildium_user_id === 'number' ? st.buildium_user_id : null
    const isUpdate = typeof localBuildiumId === 'number' && Number.isFinite(localBuildiumId)
    const url = isUpdate ? `${base.replace(/\/$/, '')}/users/${localBuildiumId}` : `${base.replace(/\/$/, '')}/users`
    const method = isUpdate ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      let details: unknown = null
      try { details = await res.json() } catch {}
      return NextResponse.json({ error: 'Buildium staff sync failed', status: res.status, endpoint: url, method, details }, { status: 502 })
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const buildiumId: number | null = typeof (data as { Id?: unknown })?.Id === 'number' ? (data as { Id: number }).Id : null
    if (buildiumId) {
      const updatePayload: StaffUpdate = { buildium_user_id: buildiumId }
      await db.from('staff').update(updatePayload).eq('id', staffId)
    }

    return NextResponse.json({ success: true, buildiumId, data })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
