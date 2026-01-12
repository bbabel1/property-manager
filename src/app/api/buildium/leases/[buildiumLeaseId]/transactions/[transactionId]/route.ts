import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { BuildiumLeaseTransactionUpdateSchema } from '@/schemas/buildium';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; transactionId: string }> },
) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('lease transaction sync')
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require platform admin
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { buildiumLeaseId, transactionId } = await params;
    const { searchParams } = new URL(request.url);
    const persist = (searchParams.get('persist') || '').toLowerCase() === 'true';

    // Make request to Buildium API
    const response = await buildiumFetch(
      'GET',
      `/leases/${buildiumLeaseId}/transactions/${transactionId}`,
      undefined,
      undefined,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease transaction fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease transaction from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const transaction = response.json ?? {};

    logger.info(`Buildium lease transaction fetched successfully`);

    // Optionally persist to database (upsert + delete/insert lines)
    if (persist) {
      try {
        const { transactionId: dbTxId } = await upsertLeaseTransactionWithLines(transaction, supabaseAdmin);
        logger.info(`Persisted lease transaction to DB: ${dbTxId}`);
      } catch (persistError) {
        logger.error({ error: persistError }, 'Error persisting lease transaction');
        return NextResponse.json(
          { error: 'Failed to persist lease transaction to database' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: transaction,
      persisted: persist || false,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease transaction`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; transactionId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;
    const { buildiumLeaseId, transactionId } = await params

    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumLeaseTransactionUpdateSchema)

    const response = await buildiumFetch(
      'PUT',
      `/leases/${buildiumLeaseId}/transactions/${transactionId}`,
      undefined,
      validated,
      orgId,
    );

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium lease transaction update failed')
      return NextResponse.json({ error: 'Failed to update lease transaction in Buildium', details: errorData }, { status: response.status })
    }

    const updated = response.json ?? {}

    try {
      const { transactionId: dbTxId } = await upsertLeaseTransactionWithLines(updated, requireSupabaseAdmin('lease transaction sync'))
      logger.info(`Persisted updated lease transaction to DB: ${dbTxId}`)
    } catch (persistError) {
      logger.error({ error: persistError }, 'Error persisting updated lease transaction')
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error });
    logger.error('Error updating Buildium lease transaction')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
