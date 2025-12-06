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

    const { data: membershipRoles, error: membershipRolesErr } = await supabaseAdmin
      .from('org_membership_roles')
      .select('user_id, org_id, role')

    if (membershipRolesErr) {
      console.warn('Failed to fetch org_membership_roles', membershipRolesErr)
    }

    const rolesByMembership = new Map<string, Set<string>>()
    for (const r of membershipRoles || []) {
      const key = `${r.user_id}:${r.org_id}`
      const set = rolesByMembership.get(key) ?? new Set<string>()
      if (r?.role) set.add(r.role)
      rolesByMembership.set(key, set)
    }

    const byUser = new Map<string, any[]>()
    for (const m of memberships || []) {
      const key = `${m.user_id}:${m.org_id}`
      const roleSet = rolesByMembership.get(key)
      const normalizedRoles = roleSet && roleSet.size > 0 ? Array.from(roleSet) : (m.role ? [m.role] : [])
      const arr = byUser.get(m.user_id) || []
      arr.push({
        org_id: m.org_id,
        org_name: (m as any).organizations?.name || '',
        roles: normalizedRoles
      })
      byUser.set(m.user_id, arr)
    }

    // Fetch contacts mapped by user_id (uses new contacts.user_id)
    const userIds = users.map((u: any) => u.id)
    let contactsByUser = new Map<string, any>()
    let staffByUser = new Map<string, any>()
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

      // Staff info keyed by user
      const { data: staffRows, error: staffErr } = await supabaseAdmin
        .from('staff')
        .select('id, user_id, role')
        .in('user_id', userIds)

      if (!staffErr) {
        staffByUser = new Map((staffRows || []).map((s: any) => [s.user_id, s]))
      }
    }

    // Permission profiles per user/org
    let profilesByUser = new Map<string, any[]>()
    try {
      const { data: profileRows, error: profileErr } = await supabaseAdmin
        .from('user_permission_profiles')
        .select('user_id, org_id, profile_id, permission_profiles(name)')
      if (!profileErr) {
        for (const row of profileRows || []) {
          const arr = profilesByUser.get(row.user_id) || []
          arr.push({
            org_id: row.org_id,
            profile_id: row.profile_id,
            profile_name: (row as any)?.permission_profiles?.name || '',
          })
          profilesByUser.set(row.user_id, arr)
        }
      }
    } catch (e) {
      console.warn('Failed to load permission profiles for users', e)
    }

    const out = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      memberships: byUser.get(u.id) || [],
      permission_profiles: profilesByUser.get(u.id) || [],
      contact: contactsByUser.get(u.id) || null,
      staff: staffByUser.get(u.id) || null,
    }))

    return NextResponse.json({ users: out })
  } catch (e: any) {
    const msg = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
