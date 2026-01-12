import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { BuildiumRecurringTransactionUpdateSchema } from '@/schemas/buildium'
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; recurringId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;
    const { buildiumLeaseId, recurringId } = await params

    const response = await buildiumFetch(
      'GET',
      `/leases/${buildiumLeaseId}/recurring-transactions/${recurringId}`,
      undefined,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium recurring transaction fetch failed')
      return NextResponse.json({ error: 'Failed to fetch Buildium recurring transaction', details: errorData }, { status: response.status })
    }

    const data = response.json ?? {}
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; recurringId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;
    const { buildiumLeaseId, recurringId } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumRecurringTransactionUpdateSchema)

    const response = await buildiumFetch(
      'PUT',
      `/leases/${buildiumLeaseId}/recurring-transactions/${recurringId}`,
      undefined,
      validated,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium recurring transaction update failed')
      return NextResponse.json({ error: 'Failed to update Buildium recurring transaction', details: errorData }, { status: response.status })
    }
    const updated = response.json ?? {}
    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; recurringId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;
    const { buildiumLeaseId, recurringId } = await params

    const response = await buildiumFetch(
      'DELETE',
      `/leases/${buildiumLeaseId}/recurring-transactions/${recurringId}`,
      undefined,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium recurring transaction delete failed')
      return NextResponse.json({ error: 'Failed to delete Buildium recurring transaction', details: errorData }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
