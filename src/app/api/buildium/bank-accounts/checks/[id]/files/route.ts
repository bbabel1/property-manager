import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: checkId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, checkId, action: 'get_buildium_check_files' }, 'Fetching Buildium check files');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/checks/${checkId}/files`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const files = (response.json ?? []) as unknown[];

    return NextResponse.json({
      success: true,
      data: files,
      count: Array.isArray(files) ? files.length : 0
    });

  } catch (error) {
    logger.error({ error, checkId }, 'Error fetching Buildium check files');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium check files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    logger.info({ userId: user.id, action: 'upload_buildium_check_file' }, 'Uploading Buildium check file');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts/checks/files', undefined, body, orgId);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newFile = response.json ?? {};

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
