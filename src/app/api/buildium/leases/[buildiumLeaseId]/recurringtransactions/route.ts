import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumRecurringTransactionCreateSchema } from '@/schemas/buildium'
import { buildiumFetch } from '@/lib/buildium-http'
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;
    const { buildiumLeaseId } = await params
    const { searchParams } = new URL(request.url)
    const orderby = searchParams.get('orderby') || undefined
    const offset = searchParams.get('offset') || undefined
    const limit = searchParams.get('limit') || undefined
    const queryParams: Record<string, string> = {}
    if (orderby) queryParams.orderby = orderby
    if (offset) queryParams.offset = offset
    if (limit) queryParams.limit = limit

    const response = await buildiumFetch(
      'GET',
      `/leases/${buildiumLeaseId}/recurring-transactions`,
      queryParams,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium recurring transactions fetch failed')
      return NextResponse.json({ error: 'Failed to fetch Buildium recurring transactions', details: errorData }, { status: response.status })
    }

    const data = response.json ?? []
    return NextResponse.json({ success: true, data, count: Array.isArray(data) ? data.length : 0 })
  } catch (error) {
    logger.error({ error });
    logger.error('Error fetching Buildium recurring transactions')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;
    const { buildiumLeaseId } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumRecurringTransactionCreateSchema)

    const response = await buildiumFetch(
      'POST',
      `/leases/${buildiumLeaseId}/recurring-transactions`,
      undefined,
      validated,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium recurring transaction create failed')
      return NextResponse.json({ error: 'Failed to create Buildium recurring transaction', details: errorData }, { status: response.status })
    }

    const created = response.json ?? {}
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    logger.error({ error });
    logger.error('Error creating Buildium recurring transaction')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
