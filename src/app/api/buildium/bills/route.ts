import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumBillCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest) {
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
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const vendorId = searchParams.get('vendorId');
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const dueDateFrom = searchParams.get('dueDateFrom');
    const dueDateTo = searchParams.get('dueDateTo');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (vendorId) queryParams.append('vendorId', vendorId);
    if (propertyId) queryParams.append('propertyId', propertyId);
    if (unitId) queryParams.append('unitId', unitId);
    if (status) queryParams.append('status', status);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    if (dueDateFrom) queryParams.append('dueDateFrom', dueDateFrom);
    if (dueDateTo) queryParams.append('dueDateTo', dueDateTo);

    const result = await buildiumFetch(
      'GET',
      '/bills',
      Object.fromEntries(queryParams.entries()),
      undefined,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium bills fetch failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to fetch bills from Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const bills = result.json;

    logger.info({ orgId }, 'Buildium bills fetched successfully');

    return NextResponse.json({
      success: true,
      data: bills,
      count: Array.isArray(bills) ? bills.length : undefined,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error fetching Buildium bills');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumBillCreateSchema);

    const result = await buildiumFetch(
      'POST',
      '/bills',
      undefined,
      validatedData,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium bill creation failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to create bill in Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const bill = result.json;

    logger.info({ orgId }, 'Buildium bill created successfully');

    return NextResponse.json({
      success: true,
      data: bill,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error creating Buildium bill');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
