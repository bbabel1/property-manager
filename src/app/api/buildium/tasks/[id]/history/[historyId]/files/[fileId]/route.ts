import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string; fileId: string }> }) {
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

    const { id, historyId, fileId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/tasks/${id}/history/${historyId}/files/${fileId}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history file fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch task history file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskHistoryFile = response.json ?? {};

    logger.info(`Buildium task history file fetched successfully`);

    return NextResponse.json({
      success: true,
      data: taskHistoryFile,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string; fileId: string }> }) {
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

    const { id, historyId, fileId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('DELETE', `/tasks/${id}/history/${historyId}/files/${fileId}`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history file deletion failed`);

      return NextResponse.json(
        { 
          error: 'Failed to delete task history file in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium task history file deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Task history file deleted successfully',
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error deleting Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string; fileId: string }> }) {
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

    const { id, historyId, fileId } = await params;

    // Make request to Buildium API for file download
    const response = await buildiumFetch('POST', `/tasks/${id}/history/${historyId}/files/${fileId}/download`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history file download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download task history file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const fileData = response.json ?? {};

    logger.info(`Buildium task history file downloaded successfully`);

    return NextResponse.json({
      success: true,
      data: fileData,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error downloading Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
