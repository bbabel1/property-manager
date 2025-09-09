import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumBulkBillPaymentCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumBulkBillPaymentCreateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/payments`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium bulk bill payment creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create bulk bill payment in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const payment = await response.json();

    logger.info(`Buildium bulk bill payment created successfully`);

    return NextResponse.json({
      success: true,
      data: payment,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium bulk bill payment`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireUser()

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const billId = searchParams.get('billId') || undefined
    const vendorId = searchParams.get('vendorId') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const { data, error } = await supabaseAdmin.functions.invoke('buildium-bills', {
      body: {
        op: 'list_payments',
        query: { limit, offset, billId, vendorId, dateFrom, dateTo }
      }
    })

    if (error || !data?.success) {
      logger.error('Buildium bill payments list failed via Edge function')
      return NextResponse.json({ error: 'Failed to fetch bill payments from Buildium', details: error?.message || data?.error }, { status: 502 })
    }

    const payments = data.data
    return NextResponse.json({ success: true, data: payments, count: Array.isArray(payments) ? payments.length : 0 })
  } catch (error) {
    logger.error('Error fetching Buildium bill payments', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
