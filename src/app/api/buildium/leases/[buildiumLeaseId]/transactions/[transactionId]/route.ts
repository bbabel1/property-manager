import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import supabaseAdmin from '@/lib/db';
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { BuildiumLeaseTransactionUpdateSchema } from '@/schemas/buildium';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    const { id, transactionId } = params;
    const { searchParams } = new URL(request.url);
    const persist = (searchParams.get('persist') || '').toLowerCase() === 'true';

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${id}/transactions/${transactionId}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium lease transaction fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch lease transaction from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const transaction = await response.json();

    logger.info(`Buildium lease transaction fetched successfully`);

    // Optionally persist to database (upsert + delete/insert lines)
    if (persist) {
      try {
        const { transactionId: dbTxId } = await upsertLeaseTransactionWithLines(transaction, supabaseAdmin);
        logger.info(`Persisted lease transaction to DB: ${dbTxId}`);
      } catch (persistError) {
        logger.error(`Error persisting lease transaction`, persistError);
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
    logger.error(`Error fetching Buildium lease transaction`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser()
    const { id, transactionId } = params

    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumLeaseTransactionUpdateSchema)

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${id}/transactions/${transactionId}`
    const response = await fetch(buildiumUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validated)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium lease transaction update failed')
      return NextResponse.json({ error: 'Failed to update lease transaction in Buildium', details: errorData }, { status: response.status })
    }

    const updated = await response.json()

    try {
      const { transactionId: dbTxId } = await upsertLeaseTransactionWithLines(updated, supabaseAdmin)
      logger.info(`Persisted updated lease transaction to DB: ${dbTxId}`)
    } catch (persistError) {
      logger.error('Error persisting updated lease transaction', persistError)
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error('Error updating Buildium lease transaction')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
