import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'

// POST /api/property-staff
// Body: { assignments: Array<{ property_id: string; staff_id: number | string; role?: string }> }
// - For PROPERTY_MANAGER: enforce one per property by replacing any existing row for that property/role
// - For other roles: insert if missing; update updated_at if exists
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json().catch(() => ({})) as { assignments?: Array<{ property_id?: string; staff_id?: number | string; role?: string }> }
    const list = Array.isArray(body.assignments) ? body.assignments : []
    if (!list.length) return NextResponse.json({ error: 'assignments required' }, { status: 400 })

    const db = supabaseAdmin || supabase
    const errors: any[] = []
    for (const a of list) {
      const propertyId = a?.property_id
      let staffId: number | null = null
      if (typeof a?.staff_id === 'string') staffId = Number(a.staff_id)
      else if (typeof a?.staff_id === 'number') staffId = a.staff_id
      const role = String(a?.role || 'PROPERTY_MANAGER').toUpperCase()
      if (!propertyId || !staffId || !Number.isFinite(staffId)) { errors.push('invalid assignment'); continue }

      // If role is PROPERTY_MANAGER, ensure there is only one per property
      if (role === 'PROPERTY_MANAGER') {
        await db.from('property_staff').delete().eq('property_id', propertyId).eq('role', 'PROPERTY_MANAGER')
      }
      const { error } = await db
        .from('property_staff')
        .upsert({ property_id: propertyId, staff_id: staffId, role: role as any, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }, { onConflict: 'property_id,staff_id,role' } as any)
      if (error) errors.push(error.message)
    }

    if (errors.length) return NextResponse.json({ error: 'One or more assignments failed', details: errors }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

