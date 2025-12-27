import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumLeaseTransactionCreateSchema } from '@/schemas/buildium'
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
) {
  try {
    const _supabaseAdmin = requireSupabaseAdmin('lease transactions sync')
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

    const { buildiumLeaseId } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const transactionType = searchParams.get('transactionType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;
    if (transactionType) queryParams.transactionType = transactionType;
    if (dateFrom) queryParams.dateFrom = dateFrom;
    if (dateTo) queryParams.dateTo = dateTo;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/leases/${buildiumLeaseId}/transactions`, queryParams, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium lease transactions fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease transactions from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const transactions = (response.json ?? []) as unknown[];

    logger.info(`Buildium lease transactions fetched successfully`);

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium lease transactions`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireRole('platform_admin')

    const { buildiumLeaseId } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumLeaseTransactionCreateSchema)

    const response = await buildiumFetch('POST', `/leases/${buildiumLeaseId}/transactions`, undefined, validated, undefined)

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Buildium lease transaction create failed')
      return NextResponse.json({ error: 'Failed to create lease transaction in Buildium', details: errorData }, { status: response.status })
    }

    const created = response.json ?? {}

    // Persist to DB with lines
    try {
      const { transactionId } = await upsertLeaseTransactionWithLines(created, requireSupabaseAdmin('lease transaction sync'))
      logger.info(`Persisted lease transaction to DB: ${transactionId}`)
    } catch (persistError) {
      logger.error({ error: persistError }, 'Error persisting created lease transaction')
      // Non-fatal for API response
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    logger.error({ error });
    logger.error('Error creating Buildium lease transaction')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
