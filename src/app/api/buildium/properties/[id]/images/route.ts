import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { BuildiumPropertyImageUploadSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const propertyId = resolvedParams.id;

    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireUser(request);

    logger.info({ userId: user.id, propertyId, action: 'get_property_images' }, 'Fetching property images');

    // Get property images from database
    const { data: images, error } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_index', { ascending: true });

    if (error) {
      logger.error({ error, userId: user.id, propertyId }, 'Error fetching property images');
      return NextResponse.json(
        { error: 'Failed to fetch property images' },
        { status: 500 }
      );
    }

    logger.info({ userId: user.id, propertyId, imageCount: images?.length || 0 }, 'Property images fetched successfully');

    return NextResponse.json({
      success: true,
      data: images || []
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching property images');
    return NextResponse.json(
      { error: 'Failed to fetch property images' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const propertyId = resolvedParams.id;

    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireUser(request);

    logger.info({ userId: user.id, propertyId, action: 'upload_property_image' }, 'Uploading property image');

    // Parse and validate request body
    const body = await request.json();
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyImageUploadSchema);

    // Resolve property + Buildium context
    const adminClient = supabaseAdmin || supabase
    const { data: propertyRow, error: propertyError } = await adminClient
      .from('properties')
      .select('id, buildium_property_id, org_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyError) {
      logger.error({ error: propertyError, propertyId, userId: user.id }, 'Error loading property before image upload');
      return NextResponse.json({ error: 'Failed to load property details' }, { status: 500 });
    }

    if (!propertyRow) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    // Determine the next sort index for locally persisted images
    const { data: existingSort } = await supabase
      .from('property_images')
      .select('sort_index')
      .eq('property_id', propertyId)
      .order('sort_index', { ascending: false })
      .limit(1)
    const nextSortIndex = (existingSort?.[0]?.sort_index ?? 0) + 1

    // Branch: Buildium-connected properties upload to Buildium service, otherwise persist locally only
    if (propertyRow.buildium_property_id) {
      const buildiumImage = await buildiumEdgeClient.uploadPropertyImage(String(propertyRow.buildium_property_id), validatedData);

      const { data: image, error } = await supabase
        .from('property_images')
        .insert({
          property_id: propertyId,
          buildium_image_id: buildiumImage.Id,
          name: buildiumImage.Name,
          description: buildiumImage.Description,
          file_type: buildiumImage.FileType,
          file_size: buildiumImage.FileSize,
          is_private: buildiumImage.IsPrivate,
          href: buildiumImage.Href,
          sort_index: nextSortIndex,
        })
        .select()
        .single();

      if (error) {
        logger.error({ error, userId: user.id, propertyId }, 'Error storing property image');
        return NextResponse.json(
          { error: 'Failed to store property image' },
          { status: 500 }
        );
      }

      logger.info({ userId: user.id, propertyId, imageId: image.id }, 'Property image uploaded successfully');

      return NextResponse.json({
        success: true,
        data: image
      });
    }

    // Local-only fallback: persist base64 payload in the database as a data URL so UI can render immediately.
    const extension = (() => {
      const parts = String(validatedData.FileName || '').split('.');
      return parts.length > 1 ? parts.pop()?.toLowerCase() ?? '' : '';
    })();
    const mimeType = (() => {
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'png':
          return 'image/png';
        case 'gif':
          return 'image/gif';
        case 'webp':
          return 'image/webp';
        case 'svg':
          return 'image/svg+xml';
        default:
          return 'application/octet-stream';
      }
    })();

    const base64 = String(validatedData.FileData || '');
    const fileSizeBytes = base64 ? Buffer.from(base64, 'base64').byteLength : null;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const { data: localImage, error: localError } = await supabase
      .from('property_images')
      .insert({
        property_id: propertyId,
        buildium_image_id: null,
        name: validatedData.FileName,
        description: validatedData.Description ?? null,
        file_type: mimeType,
        file_size: fileSizeBytes,
        is_private: false,
        href: dataUrl,
        sort_index: nextSortIndex,
      })
      .select()
      .single();

    if (localError) {
      logger.error({ error: localError, userId: user.id, propertyId }, 'Error storing local property image');
      return NextResponse.json(
        { error: 'Failed to store property image' },
        { status: 500 }
      );
    }

    logger.info({ userId: user.id, propertyId, imageId: localImage.id }, 'Local property image stored without Buildium link');

    return NextResponse.json({ success: true, data: localImage });

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error uploading property image');
    return NextResponse.json(
      { error: 'Failed to upload property image' },
      { status: 500 }
    );
  }
}
