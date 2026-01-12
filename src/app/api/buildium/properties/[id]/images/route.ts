import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumEdgeClient, getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client';
import { BuildiumPropertyImageUploadSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { hasRole } from '@/lib/auth/roles';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const propertyId = resolvedParams.id;

    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 },
      );
    }

    // Authentication
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    logger.info(
      { userId: user.id, propertyId, orgId, action: 'get_property_images' },
      'Fetching property images',
    );

    const { data: property, error: propertyError } = await db
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (propertyError) {
      logger.error(
        { error: propertyError, userId: user.id, propertyId, orgId },
        'Error verifying property before fetching images',
      );
      return NextResponse.json({ error: 'Failed to fetch property images' }, { status: 500 });
    }

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Get property images from database
    const { data: images, error } = await db
      .from('property_images')
      .select('*')
      .eq('property_id', property.id)
      .order('sort_index', { ascending: true });

    if (error) {
      logger.error({ error, userId: user.id, propertyId }, 'Error fetching property images');
      return NextResponse.json({ error: 'Failed to fetch property images' }, { status: 500 });
    }

    logger.info(
      { userId: user.id, propertyId, orgId, imageCount: images?.length || 0 },
      'Property images fetched successfully',
    );

    return NextResponse.json({
      success: true,
      data: images || [],
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Error fetching property images',
    );
    return NextResponse.json({ error: 'Failed to fetch property images' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const propertyId = resolvedParams.id;

    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 },
      );
    }

    // Authentication
    const { supabase: db, user, roles, orgRoles } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    logger.info(
      { userId: user.id, propertyId, orgId, action: 'upload_property_image' },
      'Uploading property image',
    );

    // Parse and validate request body
    const body = await request.json();
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyImageUploadSchema);

    // Resolve property + Buildium context
    const { data: propertyRow, error: propertyError } = await db
      .from('properties')
      .select('id, buildium_property_id, org_id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (propertyError) {
      logger.error(
        { error: propertyError, propertyId, userId: user.id },
        'Error loading property before image upload',
      );
      return NextResponse.json({ error: 'Failed to load property details' }, { status: 500 });
    }

    if (!propertyRow) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    const scopedRoles = orgRoles?.[orgId] ?? roles;
    if (!hasRole(scopedRoles, ['org_admin', 'org_manager', 'platform_admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Determine the next sort index for locally persisted images
    const { data: existingSort } = await db
      .from('property_images')
      .select('sort_index')
      .eq('property_id', propertyId)
      .order('sort_index', { ascending: false })
      .limit(1);
    const nextSortIndex = (existingSort?.[0]?.sort_index ?? 0) + 1;

    const rawFileData = String(validatedData.FileData || '');
    const normalized = normalizeBase64(rawFileData);
    const base64 = normalized.base64;
    const fileName = validatedData.FileName || 'property-image';
    const extension = (() => {
      const parts = fileName.split('.');
      return parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
    })();
    const mimeType = (() => {
      if (normalized.mime) return normalized.mime;
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
    const fileBuffer = base64 ? Buffer.from(base64, 'base64') : null;
    const fileSizeBytes = fileBuffer?.byteLength ?? null;
    const dataUrl = base64 ? `data:${mimeType};base64,${base64}` : null;

    async function storeLocalImage() {
      const { data: localImage, error: localError } = await db
        .from('property_images')
        .insert({
          property_id: propertyId,
          buildium_image_id: null,
          name: fileName,
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
        logger.error(
          { error: localError, userId: user.id, propertyId, orgId },
          'Error storing local property image',
        );
        return NextResponse.json({ error: 'Failed to store property image' }, { status: 500 });
      }

      logger.info(
        { userId: user.id, propertyId, orgId, imageId: localImage?.id },
        'Local property image stored',
      );
      return NextResponse.json({ success: true, data: localImage });
    }

    // Branch: Buildium-connected properties upload to Buildium service, otherwise persist locally only
    if (propertyRow.buildium_property_id) {
      try {
        const client: BuildiumEdgeClient = await getOrgScopedBuildiumEdgeClient(orgId);

        const buildiumImageResult = await client.uploadPropertyImage(
          String(propertyRow.buildium_property_id),
          {
            FileName: fileName,
            FileData: base64,
            Description: validatedData.Description ?? null,
          },
        );
        const buildiumImage = ((buildiumImageResult as { data?: unknown })?.data ??
          buildiumImageResult ??
          null) as any;

        const placeholderHref = dataUrl ?? buildiumImage?.Href ?? null;
        const { data: image, error } = await db
          .from('property_images')
          .insert({
            property_id: propertyId,
            buildium_image_id: buildiumImage?.Id ?? null,
            name: buildiumImage?.Name ?? fileName,
            description: buildiumImage?.Description ?? validatedData.Description ?? null,
            file_type: mimeType,
            file_size: fileSizeBytes,
            is_private:
              typeof buildiumImage?.IsPrivate === 'boolean' ? buildiumImage.IsPrivate : null,
            href: placeholderHref,
            sort_index:
              typeof buildiumImage?.SortOrder === 'number'
                ? buildiumImage.SortOrder
                : nextSortIndex,
          })
          .select()
          .single();

        if (error || !image) {
          logger.error(
            { error, userId: user.id, propertyId, orgId },
            'Error storing property image after Buildium upload',
          );
          return NextResponse.json({ error: 'Failed to store property image' }, { status: 500 });
        }

        logger.info(
          { userId: user.id, propertyId, orgId, imageId: image.id },
          'Property image uploaded to Buildium successfully',
        );
        return NextResponse.json({ success: true, data: image });
      } catch (buildiumError) {
        const message =
          buildiumError instanceof Error
            ? buildiumError.message
            : 'Failed to upload property image to Buildium';
        logger.error(
          { error: message, userId: user.id, propertyId, orgId },
          'Buildium property image upload failed; falling back to local storage',
        );
        return await storeLocalImage();
      }
    }

    // Local-only fallback for properties not yet linked to Buildium
    return await storeLocalImage();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    logger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Error uploading property image',
    );
    return NextResponse.json({ error: 'Failed to upload property image' }, { status: 500 });
  }
}

function normalizeBase64(value: string): { base64: string; mime?: string } {
  if (!value) return { base64: '' };
  const match = value.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return { mime: match[1], base64: match[2] };
  }
  return { base64: value };
}
