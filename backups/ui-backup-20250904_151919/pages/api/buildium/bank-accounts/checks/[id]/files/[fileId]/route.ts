import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const checkId = params.id;
    const fileId = params.fileId;
    
    logger.info({ userId: user.id, checkId, fileId, action: 'get_buildium_check_file' }, 'Fetching Buildium check file');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/checks/${checkId}/files/${fileId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check file not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const file = await response.json();

    return NextResponse.json({
      success: true,
      data: file
    });

  } catch (error) {
    logger.error({ error, checkId: params.id, fileId: params.fileId }, 'Error fetching Buildium check file');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const checkId = params.id;
    const fileId = params.fileId;
    
    logger.info({ userId: user.id, checkId, fileId, action: 'delete_buildium_check_file' }, 'Deleting Buildium check file');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/checks/${checkId}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

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
    logger.error({ error, checkId: params.id, fileId: params.fileId }, 'Error deleting Buildium check file');
    return NextResponse.json(
      { error: 'Failed to delete Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const checkId = params.id;
    const fileId = params.fileId;
    
    logger.info({ userId: user.id, checkId, fileId, action: 'download_buildium_check_file' }, 'Downloading Buildium check file');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/checks/${checkId}/files/${fileId}/download`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check file not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const downloadResult = await response.json();

    return NextResponse.json({
      success: true,
      data: downloadResult
    });

  } catch (error) {
    logger.error({ error, checkId: params.id, fileId: params.fileId }, 'Error downloading Buildium check file');
    return NextResponse.json(
      { error: 'Failed to download Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
