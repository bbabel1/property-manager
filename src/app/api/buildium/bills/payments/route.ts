import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumBulkBillPaymentCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireSupabaseAdmin } from '@/lib/supabase-client';

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

    // Require platform admin
    await requireRole('platform_admin');

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumBulkBillPaymentCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/bills/payments', undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium bulk bill payment creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create bulk bill payment in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const payment = response.json ?? {};

    logger.info(`Buildium bulk bill payment created successfully`);

    return NextResponse.json({
      success: true,
      data: payment,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium bulk bill payment`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole('platform_admin')
    const supabaseAdmin = requireSupabaseAdmin('fetch Buildium bill payments')
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

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
    logger.error({ error }, 'Error fetching Buildium bill payments')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
