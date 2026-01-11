import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { logger } from '@/lib/logger'

const handleError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (message === 'FORBIDDEN' || message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'ORG_CONTEXT_REQUIRED' }, { status: 400 })
  logger.error({ error }, 'Unexpected error in GET /api/organization/members')
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireRole(['org_admin', 'org_manager'])
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const orgId = await resolveOrgIdFromRequest(request, user.id)
    const supabaseAdmin = requireSupabaseAdmin('list organization members')

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('id, org_id, user_id, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (membershipError) {
      logger.error({ error: membershipError, orgId }, 'Failed to list organization members')
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    const { data: membershipRoles, error: membershipRolesError } = await supabaseAdmin
      .from('membership_roles')
      .select('user_id, org_id, role_id, roles(name)')
      .eq('org_id', orgId)

    if (membershipRolesError) {
      logger.warn({ error: membershipRolesError, orgId }, 'Failed to load membership roles for organization members')
    }

    const rolesByUser = new Map<string, string[]>()
    for (const row of membershipRoles || []) {
      const roleName =
        (row as { roles?: { name?: string | null } | null })?.roles?.name ??
        (row as { role_id?: string | null }).role_id
      if (row?.user_id && typeof roleName === 'string') {
        const list = rolesByUser.get(row.user_id) ?? []
        rolesByUser.set(row.user_id, [...list, roleName])
      }
    }

    const members = (memberships ?? []).map((member) => {
      const roles = rolesByUser.get(member.user_id) ?? []
      return {
        ...member,
        role: roles[0] ?? null,
        roles,
      }
    })

    return NextResponse.json({ members })
  } catch (error) {
    return handleError(error)
  }
}
