import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const checkId = (await params).id;
    const fileId = (await params).fileId;
    
    logger.info({ userId: user.id, checkId, fileId, action: 'get_buildium_check_file' }, 'Fetching Buildium check file');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/checks/${checkId}/files/${fileId}`, undefined, undefined, undefined);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check file not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const file = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: file
    });

  } catch (error) {
    logger.error({ error, checkId: (await params).id, fileId: (await params).fileId }, 'Error fetching Buildium check file');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const checkId = (await params).id;
    const fileId = (await params).fileId;
    
    logger.info({ userId: user.id, checkId, fileId, action: 'delete_buildium_check_file' }, 'Deleting Buildium check file');

    // Buildium API call
    const response = await buildiumFetch('DELETE', `/bankaccounts/checks/${checkId}/files/${fileId}`, undefined, undefined, undefined);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check file not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Check file deleted successfully'
    });

  } catch (error) {
    logger.error({ error, checkId: (await params).id, fileId: (await params).fileId }, 'Error deleting Buildium check file');
    return NextResponse.json(
      { error: 'Failed to delete Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const checkId = (await params).id;
    const fileId = (await params).fileId;
    
    logger.info({ userId: user.id, checkId, fileId, action: 'download_buildium_check_file' }, 'Downloading Buildium check file');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', `/bankaccounts/checks/${checkId}/files/${fileId}/download`, undefined, body, undefined);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check file not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const downloadResult = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: downloadResult
    });

  } catch (error) {
    logger.error({ error, checkId: (await params).id, fileId: (await params).fileId }, 'Error downloading Buildium check file');
    return NextResponse.json(
      { error: 'Failed to download Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
