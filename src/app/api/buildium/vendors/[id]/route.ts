import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumVendorUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Make request to Buildium API using org-scoped credentials
    // Note: platform_admin routes may not have org context, so pass undefined
    const response = await buildiumFetch('GET', `/vendors/${id}`, undefined, undefined, undefined);

    if (!response.ok) {
      logger.error(`Buildium vendor fetch failed`, { status: response.status, errorText: response.errorText });

      return NextResponse.json(
        { 
          error: 'Failed to fetch vendor from Buildium',
          details: response.errorText
        },
        { status: response.status }
      );
    }

    const vendor = response.json ?? {};

    logger.info(`Buildium vendor fetched successfully`);

    return NextResponse.json({
      success: true,
      data: vendor,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium vendor`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumVendorUpdateSchema);

    // Make request to Buildium API using org-scoped credentials
    // Note: platform_admin routes may not have org context, so pass undefined
    const response = await buildiumFetch('PUT', `/vendors/${id}`, undefined, validatedData, undefined);

    if (!response.ok) {
      logger.error(`Buildium vendor update failed`, { status: response.status, errorText: response.errorText });

      return NextResponse.json(
        { 
          error: 'Failed to update vendor in Buildium',
          details: response.errorText
        },
        { status: response.status }
      );
    }

    const vendor = response.json ?? {};

    logger.info(`Buildium vendor updated successfully`);

    return NextResponse.json({
      success: true,
      data: vendor,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium vendor`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
