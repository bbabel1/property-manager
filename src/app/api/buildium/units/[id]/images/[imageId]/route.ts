import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitImageUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import UnitService from '@/lib/unit-service';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

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
    const { supabase, user } = await requireRole('platform_admin');

    const { id, imageId } = await params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images/${imageId}`;
    
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
      logger.error(`Buildium unit image fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch unit image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const image = await response.json();
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      let orgId: string | null = null;
      try {
        orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
      } catch {
        return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
      }
      try { await UnitService.persistImages(Number(id), [image], orgId) } catch {}
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
    const { supabase, user } = await requireRole('platform_admin');

    const { id, imageId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitImageUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images/${imageId}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium unit image update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update unit image in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const image = await response.json();
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist')||'').toLowerCase());
    if (persist) {
      let orgId: string | null = null;
      try {
        orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
      } catch {
        return NextResponse.json({ error: 'Organization context required for persist' }, { status: 400 });
      }
      try { await UnitService.persistImages(Number(id), [image], orgId) } catch {}
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

    const { id, imageId } = await params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images/${imageId}`;
    
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

    const { id, imageId } = await params;

    // Make request to Buildium API for image download
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${id}/images/${imageId}/download`;
    
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
      logger.error(`Buildium unit image download failed`);

      return NextResponse.json(
        { 
          error: 'Failed to download unit image from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const downloadData = await response.json();

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
