import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitImageUploadSchema, BuildiumUnitImageOrderUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import UnitService from '@/lib/unit-service';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import type { BuildiumUnitImage } from '@/types/buildium';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Require platform admin
    const { supabase, user } = await requireRole('platform_admin');

    const { id } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/units/${id}/images`, undefined, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit images fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit images from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawImages = (response.json ?? null) as any;
    const imagesPayload = Array.isArray(rawImages?.data) ? rawImages.data : rawImages;
    const images: BuildiumUnitImage[] = Array.isArray(imagesPayload) ? imagesPayload : [];
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      let orgId: string | null = null;
      try {
        orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
      } catch {
        return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
      }
      try { await UnitService.persistImages(Number(id), images, orgId) } catch {}
    }

    logger.info(`Buildium unit images fetched successfully`);

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium unit images`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Require platform admin
    const { supabase, user } = await requireRole('platform_admin');

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitImageUploadSchema) as any;

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/rentals/units/${id}/images`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error({ status: response.status, errorData }, 'Buildium unit image upload failed');

      return NextResponse.json(
        { 
          error: 'Failed to upload unit image to Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawImage = (response.json ?? null) as any;
    const imagePayload = rawImage && typeof rawImage === 'object' && 'data' in rawImage ? (rawImage as any).data : rawImage;
    const image = (imagePayload as BuildiumUnitImage | null | undefined) ?? null;
    let orgId: string | null = null;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    } catch {
      return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
    }
    if (image) {
      try { await UnitService.persistImages(Number(id), [image], orgId) } catch {}
    }

    logger.info(`Buildium unit image uploaded successfully`);

    return NextResponse.json({
      success: true,
      data: image,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error uploading Buildium unit image`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Require platform admin
    const { supabase, user } = await requireRole('platform_admin');

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitImageOrderUpdateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/rentals/units/${id}/images/order`, undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium unit image order update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update unit image order in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const rawImages = (response.json ?? null) as any;
    const imagesPayload = Array.isArray(rawImages?.data) ? rawImages.data : rawImages;
    const images: BuildiumUnitImage[] = Array.isArray(imagesPayload) ? imagesPayload : [];
    let orgId: string | null = null;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    } catch {
      return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
    }
    try { await UnitService.persistImages(Number(id), images, orgId) } catch {}

    logger.info(`Buildium unit image order updated successfully`);

    return NextResponse.json({
      success: true,
      data: images,
      count: images.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium unit image order`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
