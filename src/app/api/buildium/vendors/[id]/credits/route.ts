import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumVendorCreditCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const validatedData = sanitizeAndValidate(body, BuildiumVendorCreditCreateSchema);

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/vendors/${id}/credits`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium vendor credit creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create vendor credit in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const credit = response.json ?? {};

    logger.info(`Buildium vendor credit created successfully`);

    return NextResponse.json({
      success: true,
      data: credit,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium vendor credit`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
