import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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

    const { id, fileId } = params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/${id}/files/${fileId}`;
    
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
      logger.error(`Buildium bill file fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch bill file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const file = await response.json();

    logger.info(`Buildium bill file fetched successfully`);

    return NextResponse.json({
      success: true,
      data: file,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium bill file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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

    const { id, fileId } = params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/${id}/files/${fileId}`;
    
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
      logger.error(`Buildium bill file deletion failed`);

      return NextResponse.json(
        { 
          error: 'Failed to delete bill file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium bill file deleted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Bill file deleted successfully',
    });

  } catch (error) {
    logger.error(`Error deleting Buildium bill file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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

    const { id, fileId } = params;

    // Make request to Buildium API for file download
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/${id}/files/${fileId}/download`;
    
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
      logger.error(`Buildium bill file download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download bill file from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const downloadData = await response.json();

    logger.info(`Buildium bill file download initiated successfully`);

    return NextResponse.json({
      success: true,
      data: downloadData,
    });

  } catch (error) {
    logger.error(`Error downloading Buildium bill file`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
