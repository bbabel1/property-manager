import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const checkId = params.id;
    
    logger.info({ userId: user.id, checkId, action: 'get_buildium_check_files' }, 'Fetching Buildium check files');

    // Buildium API call
    const response = await fetch(`https://apisandbox.buildium.com/v1/bankaccounts/checks/${checkId}/files`, {
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
          { error: 'Check not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const files = await response.json();

    return NextResponse.json({
      success: true,
      data: files,
      count: Array.isArray(files) ? files.length : 0
    });

  } catch (error) {
    logger.error({ error, checkId: params.id }, 'Error fetching Buildium check files');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium check files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'upload_buildium_check_file' }, 'Uploading Buildium check file');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/checks/files', {
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
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newFile = await response.json();

    return NextResponse.json({
      success: true,
      data: newFile
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error uploading Buildium check file');
    return NextResponse.json(
      { error: 'Failed to upload Buildium check file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
