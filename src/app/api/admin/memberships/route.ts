import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'

// POST /api/admin/memberships
// Body: { user_id: string, org_id: string, roles: string[] }
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json().catch(() => ({})) as { user_id?: string; org_id?: string; roles?: string[] }
    const userId = body.user_id
    const orgId = body.org_id
    // Normalize roles: accept human-friendly labels
    const normalize = (r: string) => {
      const t = (r || '').toLowerCase().trim()
      if (t === 'property manager' || t === 'property_manager') return 'org_manager'
      return r
    }
    const roles = Array.isArray(body.roles) ? body.roles.filter(Boolean).map(normalize) : []
    if (!userId || !orgId || roles.length === 0) {
      return NextResponse.json({ error: 'user_id, org_id and roles are required' }, { status: 400 })
    }
    const db = supabaseAdmin || supabase

    // org_memberships allows only one row per (user_id, org_id)
    // Collapse multiple selections to the highest-precedence role
    const rank: Record<string, number> = { platform_admin: 100, org_admin: 80, org_manager: 60, org_staff: 40, owner_portal: 20, tenant_portal: 10 }
    const top = roles.sort((a, b) => (rank[b] ?? 0) - (rank[a] ?? 0))[0]
    if (!top) return NextResponse.json({ error: 'No valid role provided' }, { status: 400 })

    // Upsert single membership row per user/org
    const { error } = await db
      .from('org_memberships')
      .upsert({ user_id: userId, org_id: orgId, role: top as any }, { onConflict: 'user_id,org_id' })
    if (error) return NextResponse.json({ error: 'Failed to update roles', details: error.message }, { status: 500 })

    // Auto-provision a staff row for Property Manager role when present
    if (top === 'org_manager') {
      try {
        // If no PROPERTY_MANAGER staff exists, create one
        const { data: existing } = await db
          .from('staff')
          .select('id')
          .eq('role', 'PROPERTY_MANAGER')
          .eq('is_active', true)
          .limit(1)
        if (!existing || existing.length === 0) {
          await db.from('staff').insert({ role: 'PROPERTY_MANAGER', is_active: true })
        }
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
