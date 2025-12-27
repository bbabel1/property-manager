import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyVideoImageCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

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
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyVideoImageCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/rentals/${id}/images/video`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium property video image creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create property image from video in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const image = response.json ?? {};

    logger.info(`Buildium property video image created successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium property video image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
