import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumTaskHistoryFileUploadSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string }> }) {
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

    const { id, historyId } = await params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/tasks/${id}/history/${historyId}/files`, queryParams, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history files fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch task history files from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskHistoryFiles = (response.json ?? []) as unknown[];

    logger.info(`Buildium task history files fetched successfully`);

    return NextResponse.json({
      success: true,
      data: taskHistoryFiles,
      count: taskHistoryFiles.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium task history files`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string }> }) {
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

    const { id, historyId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumTaskHistoryFileUploadSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/tasks/${id}/history/${historyId}/files`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history file upload failed`);

      return NextResponse.json(
        { 
          error: 'Failed to upload task history file in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskHistoryFile = response.json ?? {};

    logger.info(`Buildium task history file uploaded successfully`);

    return NextResponse.json({
      success: true,
      data: taskHistoryFile,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error uploading Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
