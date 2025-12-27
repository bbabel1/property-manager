import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPartialPaymentSettingsUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

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

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/partialpaymentsettings', undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium partial payment settings fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch partial payment settings from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const settings = response.json ?? {};

    logger.info(`Buildium partial payment settings fetched successfully`);

    return NextResponse.json({
      success: true,
      data: settings,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium partial payment settings`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const validatedData = sanitizeAndValidate(body, BuildiumPartialPaymentSettingsUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PATCH', '/partialpaymentsettings', undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium partial payment settings update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update partial payment settings in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const settings = response.json ?? {};

    logger.info(`Buildium partial payment settings updated successfully`);

    return NextResponse.json({
      success: true,
      data: settings,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium partial payment settings`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
