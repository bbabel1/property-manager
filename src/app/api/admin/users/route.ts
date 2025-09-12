import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireRole } from '@/lib/auth/guards'

export async function GET() {
  try {
    // Enforce admin in production; relax in dev for bootstrap
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    // List users via Admin API
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }) as any
    if (usersErr) {
      return NextResponse.json({ error: usersErr.message || 'Failed to list users' }, { status: 500 })
    }
    const users = usersData?.users || usersData || []

    // Fetch memberships with organization names
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('org_memberships')
      .select('user_id, org_id, role, organizations(name)')

    if (memErr) {
      return NextResponse.json({ error: memErr.message || 'Failed to fetch memberships' }, { status: 500 })
    }

    const byUser = new Map<string, any[]>()
    for (const m of memberships || []) {
      const arr = byUser.get(m.user_id) || []
      arr.push({ org_id: m.org_id, org_name: (m as any).organizations?.name || '', role: m.role })
      byUser.set(m.user_id, arr)
    }

    const out = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      memberships: byUser.get(u.id) || [],
    }))

    return NextResponse.json({ users: out })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

