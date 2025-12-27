import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumBillFileUploadSchema } from '@/schemas/buildium';
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

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/bills/${id}/files`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium bill files fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch bill files from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const files = (response.json ?? []) as unknown[];

    logger.info(`Buildium bill files fetched successfully`);

    return NextResponse.json({
      success: true,
      data: files,
      count: files.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium bill files`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const validatedData = sanitizeAndValidate(body, BuildiumBillFileUploadSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/bills/${id}/files`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium bill file upload failed`);

      return NextResponse.json(
        { 
          error: 'Failed to upload bill file to Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const file = response.json ?? {};

    logger.info(`Buildium bill file uploaded successfully`);

    return NextResponse.json({
      success: true,
      data: file,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error uploading Buildium bill file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
