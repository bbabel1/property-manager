import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import {
  createBuildiumClient,
  defaultBuildiumConfig,
  type BuildiumUploadTicket,
} from '@/lib/buildium-client';
import { extractBuildiumFileIdFromPayload } from '@/lib/buildium-utils';
import { logger } from '@/lib/logger';
import { FILE_ENTITY_TYPES, mapFileEntityTypeToBuildium, normalizeEntityType } from '@/lib/files';
import type { BuildiumFileEntityType, BuildiumFileCategory } from '@/types/buildium';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const admin = await requireSupabaseAdmin();

    const { id } = await params;

    // Get file from database
    const { data: file, error: fileError } = await admin
      .from('files')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if file has entity_type and entity_id
    if (!file.entity_type || !file.entity_id) {
      return NextResponse.json(
        { error: 'File must be associated with an entity to sync to Buildium' },
        { status: 400 },
      );
    }

    const entityType = normalizeEntityType(file.entity_type);
    if (!entityType) {
      return NextResponse.json(
        { error: `Invalid entity type: ${file.entity_type}` },
        { status: 400 },
      );
    }

    // Note: entity_id in files table stores the Buildium entity ID (or -1 if not synced)
    // This is set during upload: finalEntityId = buildiumEntityInfo?.buildiumEntityId ?? -1
    const entityId = typeof file.entity_id === 'number' ? file.entity_id : Number(file.entity_id);

    // Check if entity_id is -1 (local entity without Buildium ID)
    if (entityId === -1) {
      let entityName = entityType.toLowerCase();

      switch (entityType) {
        case FILE_ENTITY_TYPES.PROPERTIES:
          entityName = 'property';
          break;
        case FILE_ENTITY_TYPES.UNITS:
          entityName = 'unit';
          break;
        case FILE_ENTITY_TYPES.LEASES:
          entityName = 'lease';
          break;
        case FILE_ENTITY_TYPES.TENANTS:
          entityName = 'tenant';
          break;
        case FILE_ENTITY_TYPES.RENTAL_OWNERS:
          entityName = 'rental owner';
          break;
      }

      return NextResponse.json(
        {
          error: `This file is associated with a local ${entityName} that doesn't have a Buildium ID. Please sync the ${entityName} to Buildium first before syncing this file.`,
          entityType,
          entityId: -1,
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(entityId) || entityId <= 0) {
      return NextResponse.json(
        {
          error: 'File must be associated with a valid Buildium entity ID to sync to Buildium',
          entityType,
          entityId: file.entity_id,
        },
        { status: 400 },
      );
    }

    // entity_id already contains the Buildium entity ID, so we can use it directly
    // Map the file entity type to Buildium entity type
    const buildiumTypes = mapFileEntityTypeToBuildium(entityType);
    const buildiumEntityType = buildiumTypes[0] || 'Rental';

    const buildiumEntityInfo = {
      buildiumEntityType: buildiumEntityType as BuildiumFileEntityType,
      buildiumEntityId: entityId,
    };

    // Download file from storage
    if (!file.bucket || !file.storage_key) {
      return NextResponse.json({ error: 'File storage information is missing' }, { status: 400 });
    }

    const { data: fileData, error: downloadError } = await admin.storage
      .from(file.bucket)
      .download(file.storage_key);

    if (downloadError || !fileData) {
      logger.error({ fileId: id, error: downloadError }, 'Failed to download file for resync');
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
    }

    // Convert file to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Create Buildium client
    const buildiumClient = createBuildiumClient(defaultBuildiumConfig);

    const parseNumericId = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
      return null;
    };

    const isUuid = (value: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    const resolveBuildiumCategoryId = async (): Promise<number | null> => {
      const candidateValues: unknown[] = [
        (file as Record<string, unknown>)?.buildium_category_id,
        (file as Record<string, unknown>)?.buildiumCategoryId,
      ];

      for (const candidate of candidateValues) {
        if (candidate === undefined || candidate === null) continue;
        const numeric = parseNumericId(candidate);
        if (numeric !== null) {
          return numeric;
        }
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed && isUuid(trimmed)) {
            const { data: categoryRow, error: categoryError } = await admin
              .from('file_categories')
              .select('buildium_category_id')
              .eq('id', trimmed)
              .maybeSingle();

            if (categoryError) {
              logger.warn(
                {
                  fileId: id,
                  categoryId: trimmed,
                  error: categoryError.message,
                },
                'Failed to resolve Buildium category by UUID reference',
              );
            } else if (categoryRow?.buildium_category_id != null) {
              const resolved = parseNumericId(categoryRow.buildium_category_id);
              if (resolved !== null) return resolved;
            }
          }
        }
      }

      const legacyCategoryRef =
        (file as Record<string, unknown>).category_id ??
        (file as Record<string, unknown>).categoryId ??
        null;
      if (legacyCategoryRef !== null && legacyCategoryRef !== undefined) {
        const numeric = parseNumericId(legacyCategoryRef);
        if (numeric !== null) {
          return numeric;
        }
        if (typeof legacyCategoryRef === 'string') {
          const trimmed = legacyCategoryRef.trim();
          if (trimmed) {
            const { data: categoryRow, error: categoryError } = await admin
              .from('file_categories')
              .select('buildium_category_id')
              .eq('id', trimmed)
              .maybeSingle();
            if (categoryError) {
              logger.warn(
                {
                  fileId: id,
                  categoryId: trimmed,
                  error: categoryError.message,
                },
                'Failed to resolve Buildium category from file_categories lookup',
              );
            } else if (categoryRow?.buildium_category_id != null) {
              const resolved = parseNumericId(categoryRow.buildium_category_id);
              if (resolved !== null) return resolved;
            }
          }
        }
      }

      const categoryName =
        (file as Record<string, unknown>).category_name ??
        (file as Record<string, unknown>).categoryName ??
        null;
      if (typeof categoryName === 'string' && categoryName.trim() && typeof file.org_id === 'string') {
        const { data: categoryRow, error: categoryError } = await admin
          .from('file_categories')
          .select('buildium_category_id')
          .eq('org_id', file.org_id)
          .ilike('category_name', categoryName.trim())
          .maybeSingle();
        if (categoryError) {
          logger.warn(
            {
              fileId: id,
              categoryName,
              error: categoryError.message,
            },
            'Failed to resolve Buildium category by name match',
          );
        } else if (categoryRow?.buildium_category_id != null) {
          const resolved = parseNumericId(categoryRow.buildium_category_id);
          if (resolved !== null) return resolved;
        }
      }

      if (typeof file.org_id === 'string') {
        const { data: fallbackCategory, error: fallbackError } = await admin
          .from('file_categories')
          .select('buildium_category_id')
          .eq('org_id', file.org_id)
          .ilike('category_name', 'Uncategorized')
          .maybeSingle();
        if (fallbackError) {
          logger.debug(
            {
              fileId: id,
              error: fallbackError.message,
            },
            'Failed to resolve default Uncategorized Buildium category',
          );
        } else if (fallbackCategory?.buildium_category_id != null) {
          const resolved = parseNumericId(fallbackCategory.buildium_category_id);
          if (resolved !== null) return resolved;
        }
      }

      return null;
    };

    logger.debug(
      {
        fileId: id,
        rawBuildiumCategoryId: (file as Record<string, unknown>).buildium_category_id ?? null,
        rawLegacyCategoryId: (file as Record<string, unknown>).category_id ?? null,
        rawLegacyCategoryName: (file as Record<string, unknown>).category_name ?? null,
      },
      'Raw category metadata loaded for file resync',
    );

    let buildiumCategoryId = await resolveBuildiumCategoryId();

    type LocalCategoryRecord = {
      id?: string;
      category_name?: string | null;
      buildium_category_id?: number | null;
      description?: string | null;
      is_active?: boolean | null;
    };

    const normalizeName = (value: string): string => value.trim().toLowerCase();
    const fileRecord = file as Record<string, unknown>;

    let resolvedCategoryLabel =
      typeof fileRecord.category_name === 'string' && fileRecord.category_name.trim()
        ? fileRecord.category_name.trim()
        : null;

    if (!resolvedCategoryLabel && typeof fileRecord.category === 'string' && fileRecord.category.trim()) {
      resolvedCategoryLabel = fileRecord.category.trim();
    }

    const candidateNameSet = new Set<string>();
    if (resolvedCategoryLabel) candidateNameSet.add(resolvedCategoryLabel);
    ['Uncategorized', 'Uncategorised', 'Other', 'Miscellaneous'].forEach((name) =>
      candidateNameSet.add(name),
    );
    const candidateNames = Array.from(candidateNameSet).filter((name) => name && name.trim());
    const normalizedCandidates = candidateNames.map((name) => normalizeName(name));

    let localCategoriesCache: LocalCategoryRecord[] | null = null;
    const loadLocalCategories = async (): Promise<LocalCategoryRecord[]> => {
      if (localCategoriesCache) return localCategoriesCache;
      if (typeof file.org_id !== 'string') {
        localCategoriesCache = [];
        return localCategoriesCache;
      }

      const { data, error } = await admin
        .from('file_categories')
        .select('id, category_name, buildium_category_id, description, is_active')
        .eq('org_id', file.org_id);

      if (error) {
        logger.warn(
          {
            fileId: id,
            error: error.message,
          },
          'Failed to load local file categories while resolving Buildium category',
        );
        localCategoriesCache = [];
        return localCategoriesCache;
      }

      localCategoriesCache = Array.isArray(data) ? data : [];
      return localCategoriesCache;
    };

    const findLocalCategoryMatch = (records: LocalCategoryRecord[]): LocalCategoryRecord | null => {
      if (!records.length) return null;
      for (const record of records) {
        const name =
          typeof record.category_name === 'string' && record.category_name.trim()
            ? record.category_name.trim()
            : null;
        if (!name) continue;
        const normalized = normalizeName(name);
        if (normalizedCandidates.includes(normalized) && record.buildium_category_id != null) {
          return record;
        }
      }

      // If no exact match, look for "uncategorized" style names
      const uncategorizedFallback = records.find((record) => {
        if (record.buildium_category_id == null) return false;
        const name =
          typeof record.category_name === 'string' && record.category_name.trim()
            ? normalizeName(record.category_name.trim())
            : '';
        return name.includes('uncategor');
      });
      return uncategorizedFallback ?? null;
    };

    if (buildiumCategoryId === null) {
      const localCategories = await loadLocalCategories();
      const localMatch = findLocalCategoryMatch(localCategories);
      if (localMatch?.buildium_category_id != null) {
        buildiumCategoryId = Number(localMatch.buildium_category_id);
        if (
          (!resolvedCategoryLabel || resolvedCategoryLabel.toLowerCase().includes('uncategor')) &&
          typeof localMatch.category_name === 'string' &&
          localMatch.category_name.trim()
        ) {
          resolvedCategoryLabel = localMatch.category_name.trim();
        }
      }
    }

    let remoteCategoriesCache: BuildiumFileCategory[] | null = null;
    const loadRemoteCategories = async (): Promise<BuildiumFileCategory[]> => {
      if (remoteCategoriesCache) return remoteCategoriesCache;
      try {
        remoteCategoriesCache = await buildiumClient.getFileCategories({ pageSize: 200 });
      } catch (remoteError) {
        logger.error(
          {
            fileId: id,
            error: remoteError instanceof Error ? remoteError.message : String(remoteError),
          },
          'Failed to fetch Buildium file categories while resolving category id',
        );
        remoteCategoriesCache = [];
      }
      return remoteCategoriesCache;
    };

    const resolveRemoteCategory = (records: BuildiumFileCategory[]): BuildiumFileCategory | null => {
      if (!records.length) return null;
      for (const record of records) {
        const name =
          typeof record.Name === 'string' && record.Name.trim() ? record.Name.trim() : null;
        if (!name) continue;
        if (normalizedCandidates.includes(normalizeName(name))) {
          return record;
        }
      }

      const uncategorized = records.find((record) => {
        const name =
          typeof record.Name === 'string' && record.Name.trim() ? record.Name.trim() : '';
        return normalizeName(name).includes('uncategor');
      });
      if (uncategorized) return uncategorized;

      return records[0] ?? null;
    };

    if (buildiumCategoryId === null) {
      const remoteCategories = await loadRemoteCategories();
      const remoteMatch = resolveRemoteCategory(remoteCategories);
      if (remoteMatch?.Id != null) {
        buildiumCategoryId = Number(remoteMatch.Id);
        const remoteName =
          typeof remoteMatch.Name === 'string' && remoteMatch.Name.trim()
            ? remoteMatch.Name.trim()
            : null;
        if (remoteName) {
          resolvedCategoryLabel = remoteName;
        } else if (!resolvedCategoryLabel) {
          resolvedCategoryLabel = `Category ${remoteMatch.Id}`;
        }

        if (typeof file.org_id === 'string') {
          try {
            await admin
              .from('file_categories')
              .upsert(
                {
                  org_id: file.org_id,
                  buildium_category_id: buildiumCategoryId,
                  category_name: resolvedCategoryLabel ?? `Category ${remoteMatch.Id}`,
                  description: remoteMatch.Description ?? null,
                  is_active: remoteMatch.IsActive ?? true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'org_id,buildium_category_id' },
              );
            // Refresh local cache with upserted record
            localCategoriesCache = null;
          } catch (upsertError) {
            logger.warn(
              {
                fileId: id,
                error: upsertError instanceof Error ? upsertError.message : String(upsertError),
              },
              'Failed to upsert remote Buildium category into local file_categories',
            );
          }
        }
      }
    }

    if (buildiumCategoryId === null) {
      return NextResponse.json(
        {
          error:
            'Unable to determine a Buildium file category for this file. Please sync file categories and try again.',
        },
        { status: 400 },
      );
    }

    if (file.buildium_category_id == null || Number(file.buildium_category_id) !== buildiumCategoryId) {
      try {
        await admin.from('files').update({ buildium_category_id: buildiumCategoryId }).eq('id', id);
      } catch (persistError) {
        logger.warn(
          {
            fileId: id,
            error: persistError instanceof Error ? persistError.message : String(persistError),
          },
          'Failed to persist Buildium category id on file record',
        );
      }
    }

    if (!resolvedCategoryLabel) {
      resolvedCategoryLabel = 'Uncategorized';
    }

    // Prepare upload request payload
    // Note: EntityType and EntityId are passed separately to createFileUploadRequest
    // The method adds them to the payload internally
    const uploadPayload: {
      FileName: string;
      Title?: string;
      Description?: string | null;
      CategoryId?: number | null;
      ContentType?: string | null;
      Category?: string | null;
    } = {
      FileName: file.file_name || 'file',
    };

    if (file.title) {
      uploadPayload.Title = file.title;
    }
    if (file.description) {
      uploadPayload.Description = file.description;
    }
    uploadPayload.CategoryId = buildiumCategoryId;

    logger.debug(
      {
        fileId: id,
        requestedCategoryId: uploadPayload.CategoryId ?? null,
        requestedCategoryLabel: resolvedCategoryLabel,
      },
      'Resolved Buildium category mapping for file resync upload',
    );

    if (file.mime_type) {
      uploadPayload.ContentType = file.mime_type;
    }

    // Create upload request using Buildium client
    // The method will add EntityType and EntityId to the payload
    let uploadTicket: BuildiumUploadTicket | null = null;
    try {
      const result = await buildiumClient.createFileUploadRequest(
        buildiumEntityInfo.buildiumEntityType,
        buildiumEntityInfo.buildiumEntityId,
        uploadPayload,
      );
      uploadTicket = result;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const categoryError =
        message.includes('CategoryId') &&
        (message.includes('missing') || message.includes('invalid') || message.includes('422'));

      if (categoryError && uploadPayload.CategoryId != null) {
        logger.warn(
          {
            fileId: id,
            buildiumEntityType: buildiumEntityInfo.buildiumEntityType,
            buildiumEntityId: buildiumEntityInfo.buildiumEntityId,
            categoryId: uploadPayload.CategoryId,
            error: message,
          },
          'Buildium upload request failed due to CategoryId; retrying without category id',
        );

        const fallbackPayload = { ...uploadPayload };
        delete fallbackPayload.CategoryId;
        fallbackPayload.Category = resolvedCategoryLabel ?? 'Uncategorized';

        const fallbackResult = await buildiumClient.createFileUploadRequest(
          buildiumEntityInfo.buildiumEntityType,
          buildiumEntityInfo.buildiumEntityId,
          fallbackPayload,
        );
        uploadTicket = fallbackResult;
      } else {
        throw error;
      }
    }

    if (!uploadTicket?.BucketUrl || !uploadTicket?.FormData) {
      return NextResponse.json(
        { error: 'Failed to create Buildium upload request' },
        { status: 500 },
      );
    }

    const ticketFileId = extractBuildiumFileIdFromPayload(uploadTicket);
    const ticketHref =
      typeof (uploadTicket as Record<string, unknown>)?.Href === 'string'
        ? String(uploadTicket.Href)
        : null;

    // Upload file to Buildium bucket
    const formData = new FormData();
    if (uploadTicket.FormData) {
      for (const [key, value] of Object.entries(uploadTicket.FormData)) {
        if (value != null) {
          formData.append(key, String(value));
        }
      }
    }

    // Create blob from base64
    const binary = Buffer.from(base64, 'base64');
    const mimeType = file.mime_type || 'application/octet-stream';
    formData.append('file', new Blob([binary], { type: mimeType }), file.file_name || 'file');

    const uploadResponse = await fetch(uploadTicket.BucketUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => '');
      logger.error(
        { fileId: id, status: uploadResponse.status, errorText },
        'Failed to upload file to Buildium bucket',
      );
      return NextResponse.json(
        {
          error: `Failed to upload file to Buildium: ${uploadResponse.status} ${errorText}`,
        },
        { status: 500 },
      );
    }

    // According to Buildium API documentation, the upload request returns:
    // - BucketUrl: URL to upload the file
    // - FormData: Form fields for the upload
    // - PhysicalFileName: The file identifier (may be the file ID or filename)
    // After uploading to the bucket, Buildium processes the file.
    // We'll store the PhysicalFileName if available, or wait for Buildium to process it.
    let buildiumFileId: number | null = ticketFileId ?? null;

    // Check if PhysicalFileName is a numeric ID
    if (!buildiumFileId && uploadTicket.PhysicalFileName) {
      const parsedId = Number(uploadTicket.PhysicalFileName);
      if (Number.isFinite(parsedId) && parsedId > 0) {
        buildiumFileId = parsedId;
      }
    }

    // If we don't have a file ID yet, wait for Buildium to process the file
    // Note: The general files API doesn't have a direct way to list files by entity
    // so we'll store what we have and update later if needed
    if (!buildiumFileId) {
      // Wait a bit for Buildium to process the file
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to extract file ID from Href if available
      if (!buildiumFileId && uploadTicket.Href) {
        const hrefMatch = uploadTicket.Href.match(/\/(\d+)(?:\?|$)/);
        if (hrefMatch) {
          buildiumFileId = Number(hrefMatch[1]);
        }
      }
    }

    // Update file record with Buildium file ID
    const updates: Record<string, unknown> = {
      buildium_file_id: buildiumFileId,
      buildium_href: ticketHref || uploadTicket.Href || null,
    };

    const { error: updateError } = await admin.from('files').update(updates).eq('id', id);

    if (updateError) {
      logger.error({ fileId: id, error: updateError }, 'Failed to update file with Buildium ID');
      return NextResponse.json(
        { error: 'File uploaded to Buildium but failed to update local record' },
        { status: 500 },
      );
    }

    logger.info(
      {
        fileId: id,
        buildiumFileId,
        buildiumEntityType: buildiumEntityInfo.buildiumEntityType,
        buildiumEntityId: buildiumEntityInfo.buildiumEntityId,
      },
      'File resynced to Buildium successfully',
    );

    return NextResponse.json({
      success: true,
      message: 'File synced to Buildium successfully',
      data: {
        buildiumFileId,
        buildiumHref: ticketHref || uploadTicket.Href || null,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      'Error resyncing file to Buildium',
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to resync file to Buildium',
      },
      { status: 500 },
    );
  }
}
