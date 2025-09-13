import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { mapStaffToBuildium } from '@/lib/buildium-mappers'

export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
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
    const localBuildiumId: number | null = (st as any)?.buildium_staff_id ?? (st as any)?.buildium_user_id ?? null
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
      let details: any = null
      try { details = await res.json() } catch {}
      return NextResponse.json({ error: 'Buildium staff sync failed', status: res.status, endpoint: url, method, details }, { status: 502 })
    }

    const data = await res.json().catch(() => ({} as any))
    const buildiumId: number | null = typeof data?.Id === 'number' ? data.Id : null

    if (buildiumId) {
      // Update local record with returned ID; mirror into buildium_user_id for compatibility if present.
      await db
        .from('staff')
        .update({ buildium_staff_id: buildiumId, buildium_user_id: buildiumId } as any)
        .eq('id', staffId)
    }

    return NextResponse.json({ success: true, buildiumId, data })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
