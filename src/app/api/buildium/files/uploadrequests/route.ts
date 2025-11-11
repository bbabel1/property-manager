import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumFileUploadRequestSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';

/**
 * POST /api/buildium/files/uploadrequests
 *
 * Step 1 of Buildium two-step file upload process.
 * Creates an upload request and returns temporary upload URL and form data.
 *
 * Based on: https://developer.buildium.com/#tag/Files/operation/ExternalApiFilesUploads_CreateUploadFileRequestAsync
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Require authentication
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = sanitizeAndValidate(body, BuildiumFileUploadRequestSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/files/uploadrequests`;

    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(
        {
          error: errorData,
          status: response.status,
          validatedData,
        },
        'Buildium file upload request failed',
      );

      return NextResponse.json(
        {
          error: 'Failed to create file upload request in Buildium',
          details: errorData,
        },
        { status: response.status },
      );
    }

    const uploadResponse = await response.json();

    logger.info(
      {
        entityType: validatedData.EntityType,
        entityId: validatedData.EntityId,
        fileName: validatedData.FileName,
      },
      'Buildium file upload request created successfully',
    );

    return NextResponse.json(
      {
        success: true,
        data: uploadResponse, // Contains BucketUrl, FormData, PhysicalFileName
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ error }, 'Error creating Buildium file upload request');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
