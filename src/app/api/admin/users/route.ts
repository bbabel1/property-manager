import { NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type MembershipRow = {
  user_id: string
  org_id: string
  organizations: { name: string | null } | null
}

type MembershipRoleRow = {
  user_id: string
  org_id: string
  roles: { name: string | null } | null
}

type ContactRow = {
  id: string
  user_id: string | null
  first_name: string | null
  last_name: string | null
  primary_phone: string | null
  primary_email: string | null
}

type StaffRow = Pick<Database['public']['Tables']['staff']['Row'], 'id' | 'user_id' | 'role'>

export async function GET() {
  try {
    // Restrict to platform_admin to avoid cross-org disclosure
    await requireRole('platform_admin')
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const supabaseAdmin = requireSupabaseAdmin('list users')

    // List users via Admin API
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 })
    if (usersErr) {
      return NextResponse.json({ error: usersErr.message || 'Failed to list users' }, { status: 500 })
    }
    const users: User[] = usersData?.users || []

    // Fetch memberships with organization names
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('org_memberships')
      .select('user_id, org_id, organizations(name)')
      .returns<MembershipRow[]>()

    if (memErr) {
      return NextResponse.json({ error: memErr.message || 'Failed to fetch memberships' }, { status: 500 })
    }

    const { data: membershipRoles, error: membershipRolesErr } = await supabaseAdmin
      .from('membership_roles')
      .select('user_id, org_id, roles(name)')
      .returns<MembershipRoleRow[]>()

    if (membershipRolesErr) {
      console.warn('Failed to fetch membership_roles', membershipRolesErr)
    }

    const rolesByMembership = new Map<string, Set<string>>()
    for (const r of membershipRoles || []) {
      const key = `${r.user_id}:${r.org_id}`
      const set = rolesByMembership.get(key) ?? new Set<string>()
      const roleName = r.roles?.name
      if (roleName) set.add(roleName)
      rolesByMembership.set(key, set)
    }

    const byUser = new Map<
      string,
      Array<{
        org_id: string
        org_name: string
        roles: string[]
      }>
    >()
    for (const m of memberships || []) {
      const key = `${m.user_id}:${m.org_id}`
      const roleSet = rolesByMembership.get(key)
      const normalizedRoles = roleSet && roleSet.size > 0 ? Array.from(roleSet) : []
      const arr = byUser.get(m.user_id) || []
      arr.push({
        org_id: m.org_id,
        org_name: m.organizations?.name || '',
        roles: normalizedRoles
      })
      byUser.set(m.user_id, arr)
    }

    // Fetch contacts mapped by user_id (uses new contacts.user_id)
    const userIds = users.map((u) => u.id)
    let contactsByUser = new Map<
      string,
      {
        id: string
        first_name: string | null
        last_name: string | null
        phone: string | null
        email: string | null
      }
    >()
    let staffByUser = new Map<
      string,
      {
        id: string
        user_id: string | null
        role: StaffRow['role']
      }
    >()
    if (userIds.length > 0) {
      const { data: contacts, error: cErr } = await supabaseAdmin
        .from('contacts')
        .select('id, user_id, first_name, last_name, primary_phone:primary_phone, primary_email:primary_email')
        .in('user_id', userIds)
        .returns<ContactRow[]>()

      if (!cErr) {
        contactsByUser = new Map(
          (contacts || [])
            .filter((c): c is ContactRow => Boolean(c && c.user_id))
            .map((c) => [
              c.user_id as string,
              {
                id: c.id,
                first_name: c.first_name || null,
                last_name: c.last_name || null,
                phone: c.primary_phone || null,
                email: c.primary_email || null,
              },
            ])
        )
      }

      // Staff info keyed by user
      const { data: staffRows, error: staffErr } = await supabaseAdmin
        .from('staff')
        .select('id, user_id, role')
        .in('user_id', userIds)
        .returns<StaffRow[]>()

      if (!staffErr) {
        staffByUser = new Map(
          (staffRows || [])
            .filter((s): s is StaffRow & { user_id: string } => Boolean(s?.user_id))
            .map((s) => [
              s.user_id,
              {
                ...s,
                id: String(s.id),
              },
            ])
        )
      }
    }

    const out = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      app_metadata: u.app_metadata ?? {},
      memberships: byUser.get(u.id) || [],
      contact: contactsByUser.get(u.id) || null,
      staff: staffByUser.get(u.id) || null,
    }))

    return NextResponse.json({ users: out })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
