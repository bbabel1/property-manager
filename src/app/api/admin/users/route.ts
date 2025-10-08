import { NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'

export async function GET() {
  try {
    // Enforce admin in production; relax in dev for bootstrap
    if (process.env.NODE_ENV === 'production') {
      await requireRole('org_admin')
    }
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const supabaseAdmin = requireSupabaseAdmin('list users')

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

    // Fetch contacts mapped by user_id (uses new contacts.user_id)
    const userIds = users.map((u: any) => u.id)
    let contactsByUser = new Map<string, any>()
    if (userIds.length > 0) {
      const { data: contacts, error: cErr } = await supabaseAdmin
        .from('contacts')
        .select('id, user_id, first_name, last_name, primary_phone:primary_phone, primary_email:primary_email')
        .in('user_id', userIds)

      if (!cErr) {
        contactsByUser = new Map((contacts || []).filter(Boolean).map((c: any) => [c.user_id, {
          id: c.id,
          first_name: c.first_name || null,
          last_name: c.last_name || null,
          phone: c.primary_phone || null,
          email: c.primary_email || null,
        }]))
      }
    }

    const out = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      memberships: byUser.get(u.id) || [],
      contact: contactsByUser.get(u.id) || null,
    }))

    return NextResponse.json({ users: out })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
