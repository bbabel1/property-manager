import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase-client'
import { logger } from '@/lib/logger'
import { requireUser } from '@/lib/auth'

const normalizeOrgId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

const collectCandidates = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectCandidates(entry))
  }
  return value === undefined ? [] : [value]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let orgId =
      searchParams.get('orgId') ||
      request.headers.get('x-org-id') ||
      request.cookies.get('x-org-id')?.value ||
      null
    const type = searchParams.get('type') || undefined
    const isActive = searchParams.get('isActive')

    const db = getServerSupabaseClient('api:gl-accounts:list')

    let resolvedUser: Awaited<ReturnType<typeof requireUser>> | null = null
    if (!orgId) {
      const encodedUser = request.headers.get('x-auth-user')
      if (encodedUser) {
        try {
          const decoded = decodeURIComponent(encodedUser)
          const parsed = JSON.parse(decoded) as {
            app_metadata?: {
              claims?: { org_ids?: unknown }
              org_ids?: unknown
              default_org_id?: unknown
              org_id?: unknown
            }
            user_metadata?: {
              org_ids?: unknown
              default_org_id?: unknown
              org_id?: unknown
            }
          } | null
          if (parsed) {
            const headerCandidates: unknown[] = []
            headerCandidates.push(
              ...collectCandidates(parsed.app_metadata?.claims?.org_ids),
              ...collectCandidates(parsed.app_metadata?.org_ids),
              ...collectCandidates(parsed.app_metadata?.default_org_id),
              ...collectCandidates(parsed.app_metadata?.org_id),
              ...collectCandidates(parsed.user_metadata?.org_ids),
              ...collectCandidates(parsed.user_metadata?.default_org_id),
              ...collectCandidates(parsed.user_metadata?.org_id)
            )
            for (const candidate of headerCandidates) {
              const normalized = normalizeOrgId(candidate)
              if (normalized) {
                orgId = normalized
                break
              }
            }
          }
        } catch (error) {
          logger.warn({ error }, 'Failed to parse x-auth-user header for org id')
        }
      }
    }

    if (!orgId) {
      try {
        resolvedUser = await requireUser(request)
      } catch (error) {
        logger.warn({ error }, 'Failed to resolve user while inferring GL account org id')
      }

      if (resolvedUser) {
        const { app_metadata, user_metadata } = resolvedUser
        const userCandidates: unknown[] = []
        userCandidates.push(
          ...collectCandidates(app_metadata?.claims?.org_ids),
          ...collectCandidates(app_metadata?.org_ids),
          ...collectCandidates(app_metadata?.default_org_id),
          ...collectCandidates((app_metadata as any)?.org_id),
          ...collectCandidates(user_metadata?.org_ids),
          ...collectCandidates(user_metadata?.default_org_id),
          ...collectCandidates((user_metadata as any)?.org_id)
        )
        for (const candidate of userCandidates) {
          const normalized = normalizeOrgId(candidate)
          if (normalized) {
            orgId = normalized
            break
          }
        }
      }
    }

    if (!orgId && resolvedUser?.id) {
      try {
        const { data: membership } = await db
          .from('org_memberships')
          .select('org_id')
          .eq('user_id', resolvedUser.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        const normalized = normalizeOrgId(membership?.org_id)
        if (normalized) orgId = normalized
      } catch (error) {
        logger.warn(
          { error, userId: resolvedUser.id },
          'Failed to resolve org from org_memberships for GL accounts'
        )
      }
    }

    if (!orgId && process.env.NODE_ENV !== 'production') {
      try {
        const { data: orgRow } = await db
          .from('organizations')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        const normalized = normalizeOrgId(orgRow?.id)
        if (normalized) orgId = normalized
      } catch (error) {
        logger.warn({ error }, 'Failed to resolve fallback organization for GL accounts route')
      }
    }

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    let query = db
      .from('gl_accounts')
      .select('id, name, type, is_active, is_security_deposit_liability')
      .eq('org_id', orgId)

    if (type) query = query.eq('type', type)
    if (isActive !== null) {
      if (isActive === 'true') query = query.eq('is_active', true)
      if (isActive === 'false') query = query.eq('is_active', false)
    }

    query = query.order('name', { ascending: true })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err) {
    logger.error({ err }, 'Error in GET /api/gl-accounts')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

