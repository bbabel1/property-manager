import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitImageUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import UnitService from '@/lib/unit-service';
import type { BuildiumUnitImage } from '@/types/buildium';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id, imageId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/units/${id}/images/${imageId}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit image fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawImage = (response.json ?? null) as any;
    const imagePayload = rawImage && typeof rawImage === 'object' && 'data' in rawImage ? (rawImage as any).data : rawImage;
    const image = (imagePayload as BuildiumUnitImage | null | undefined) ?? null;
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      if (image) {
        try { await UnitService.persistImages(Number(id), [image], orgId) } catch {}
      }
    }

    logger.info(`Buildium unit image fetched successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium unit image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id, imageId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitImageUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/units/${id}/images/${imageId}`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit image update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update unit image in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawImage = (response.json ?? null) as any;
    const imagePayload = rawImage && typeof rawImage === 'object' && 'data' in rawImage ? (rawImage as any).data : rawImage;
    const image = (imagePayload as BuildiumUnitImage | null | undefined) ?? null;
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      if (image) {
        try { await UnitService.persistImages(Number(id), [image], orgId) } catch {}
      }
    }

    logger.info(`Buildium unit image updated successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium unit image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id, imageId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('DELETE', `/rentals/units/${id}/images/${imageId}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit image deletion failed`);

      return NextResponse.json(
        { 
          error: 'Failed to delete unit image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    logger.info(`Buildium unit image deleted successfully`);
    try { await UnitService.deleteImage(Number(id), Number(imageId)) } catch {}

    return NextResponse.json({
      success: true,
      message: 'Unit image deleted successfully',
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error deleting Buildium unit image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
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
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id, imageId } = await params;

    // Make request to Buildium API for image download
    const response = await buildiumFetch('POST', `/rentals/units/${id}/images/${imageId}/download`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit image download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download unit image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const downloadData = response.json ?? {};

    logger.info(`Buildium unit image download initiated successfully`);

    return NextResponse.json({
      success: true,
      data: downloadData,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error downloading Buildium unit image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
