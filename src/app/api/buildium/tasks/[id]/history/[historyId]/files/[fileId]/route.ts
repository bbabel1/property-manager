import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; historyId: string; fileId: string } }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    const { id, historyId, fileId } = params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/tasks/${id}/history/${historyId}/files/${fileId}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium task history file fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch task history file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskHistoryFile = await response.json();

    logger.info(`Buildium task history file fetched successfully`);

    return NextResponse.json({
      success: true,
      data: taskHistoryFile,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; historyId: string; fileId: string } }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    const { id, historyId, fileId } = params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/tasks/${id}/history/${historyId}/files/${fileId}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
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
    logger.error(`Error deleting Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; historyId: string; fileId: string } }
) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    const { id, historyId, fileId } = params;

    // Make request to Buildium API for file download
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/tasks/${id}/history/${historyId}/files/${fileId}/download`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium task history file download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download task history file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const fileData = await response.json();

    logger.info(`Buildium task history file downloaded successfully`);

    return NextResponse.json({
      success: true,
      data: fileData,
    });

  } catch (error) {
    logger.error(`Error downloading Buildium task history file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
