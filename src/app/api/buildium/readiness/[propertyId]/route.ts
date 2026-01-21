import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'
import { logger } from '@/lib/logger'
import { evaluateBuildiumReadiness, updateOnboardingStatusForBuildium } from '@/lib/buildium-readiness'

type Issue = { code: string; message: string; path?: string }

/**
 * GET /api/buildium/readiness/:propertyId
 * Checks minimum required fields for Buildium sync.
 *
 * This is a lightweight checklist: it verifies property basics, at least one unit,
 * and at least one owner. Bank account and services are optional but flagged if missing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  try {
    const { propertyId } = await params
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })

    const readiness = await evaluateBuildiumReadiness({ db, propertyId, orgId })

    if (readiness.ready) {
      await updateOnboardingStatusForBuildium(db, propertyId, orgId, 'READY_FOR_BUILDIUM')
    }

    return NextResponse.json({
      ready: readiness.ready,
      issues: readiness.issues as Issue[],
    })
  } catch (error) {
    logger.error({ error }, 'GET /api/buildium/readiness failed')
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
