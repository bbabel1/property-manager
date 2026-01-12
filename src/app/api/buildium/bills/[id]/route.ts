import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumBillUpdateSchema, BuildiumBillPatchSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch, type BuildiumMethod } from '@/lib/buildium-http';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

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
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { id } = await params;

    const result = await buildiumFetch(
      'GET',
      `/bills/${id}`,
      undefined,
      undefined,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium bill fetch failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to fetch bill from Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const bill = result.json;

    logger.info({ orgId }, 'Buildium bill fetched successfully');

    return NextResponse.json({
      success: true,
      data: bill,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error fetching Buildium bill');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumBillUpdateSchema);

    const result = await buildiumFetch(
      'PUT',
      `/bills/${id}`,
      undefined,
      validatedData,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium bill update failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to update bill in Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const bill = result.json;

    logger.info({ orgId }, 'Buildium bill updated successfully');

    return NextResponse.json({
      success: true,
      data: bill,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error updating Buildium bill');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumBillPatchSchema);

    const patchMethod: BuildiumMethod = 'PATCH';
    const result = await buildiumFetch(
      patchMethod,
      `/bills/${id}`,
      undefined,
      validatedData,
      orgId
    );

    if (!result.ok) {
      logger.error(
        { orgId, status: result.status, error: result.errorText },
        'Buildium bill patch failed'
      );

      return NextResponse.json(
        { 
          error: 'Failed to patch bill in Buildium',
          details: result.json ?? result.errorText
        },
        { status: result.status || 502 }
      );
    }

    const bill = result.json;

    logger.info({ orgId }, 'Buildium bill patched successfully');

    return NextResponse.json({
      success: true,
      data: bill,
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    logger.error({ error }, 'Error patching Buildium bill');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
