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

    const { data, error } = await supabaseAdmin
      .from('org_memberships')
      .select('id, user_id, role, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error({ error, orgId }, 'Failed to list organization members')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ members: data || [] })
  } catch (error) {
    return handleError(error)
  }
}
