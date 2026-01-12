#!/usr/bin/env npx tsx
/**
 * Sync Buildium files for a specific entity to local database
 *
 * Usage: npx tsx scripts/buildium/sync/sync-files-for-entity.ts <entityType> <entityId> <orgId>
 *
 * Example: npx tsx scripts/buildium/sync/sync-files-for-entity.ts Lease 12345 <org-uuid>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { BuildiumFile, BuildiumEntityType } from '@/types/buildium';
import { resolveFileCategoryIdFromBuildium } from '@/lib/buildium-mappers';
import { ensureBuildiumEnabledForScript } from '../ensure-enabled';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchFilesFromBuildium(
  entityType: BuildiumEntityType,
  entityId: number,
): Promise<BuildiumFile[]> {
  const allFiles: BuildiumFile[] = [];
  let pageNumber = 1;
  const pageSize = 100;

  console.log(`Fetching files from Buildium for ${entityType} ${entityId}...`);

  while (true) {
    try {
      const queryParams = new URLSearchParams({
        entityType,
        entityId: entityId.toString(),
        pageSize: pageSize.toString(),
        pageNumber: pageNumber.toString(),
      });

      const url = `${process.env.BUILDIUM_BASE_URL}/files?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
          'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'x-buildium-egress-allowed': '1',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // Handle different response formats
      let files: BuildiumFile[] = [];

      if (Array.isArray(result)) {
        files = result;
      } else if (result.data && Array.isArray(result.data)) {
        files = result.data;
      } else if (result.value && Array.isArray(result.value)) {
        files = result.value;
      } else {
        throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
      }

      console.log(`Fetched page ${pageNumber} with ${files.length} files`);

      allFiles.push(...files);

      // Check if we've fetched all pages
      if (files.length < pageSize) {
        break;
      }

      pageNumber++;
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error);
      throw error;
    }
  }

  return allFiles;
}

async function syncFilesToDatabase(
  files: BuildiumFile[],
  orgId: string,
): Promise<{ synced: number; updated: number; errors: number }> {
  let synced = 0;
  let updated = 0;
  let errors = 0;

  console.log(`Syncing ${files.length} files to org ${orgId}...`);

  for (const file of files) {
    try {
      // Check if file already exists
      const { data: existing } = await supabase
        .from('files')
        .select('id')
        .eq('buildium_file_id', file.Id)
        .maybeSingle();

      // Resolve category foreign key from buildium_category_id
      const categoryId = await resolveFileCategoryIdFromBuildium(
        file.CategoryId || null,
        orgId,
        supabase
      );

      const fileData = {
        org_id: orgId,
        file_name: file.FileName,
        title: file.Title,
        description: file.Description || null,
        entity_type: file.EntityType,
        entity_id: file.EntityId || 0,
        buildium_category_id: file.CategoryId || null,
        category: categoryId, // Set the foreign key
        buildium_file_id: file.Id,
        buildium_href: file.Href || null,
        mime_type: file.FileType || null,
        size_bytes: file.FileSize || null,
        is_private: file.IsPrivate ?? true,
        storage_provider: 'buildium',
        external_url: file.Href || null,
      };

      if (existing) {
        // Update existing file
        const { error } = await supabase.from('files').update(fileData).eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Insert new file
        const { error } = await supabase.from('files').insert(fileData);

        if (error) throw error;
        synced++;
      }
    } catch (error) {
      console.error(`Error syncing file ${file.Id}:`, error);
      errors++;
    }
  }

  return { synced, updated, errors };
}

async function main() {
  const entityType = process.argv[2] as BuildiumEntityType;
  const entityId = parseInt(process.argv[3]);
  const orgId = process.argv[4];

  if (!entityType || !entityId || !orgId) {
    console.error(
      'Usage: npx tsx scripts/buildium/sync/sync-files-for-entity.ts <entityType> <entityId> <orgId>',
    );
    console.error(
      'Example: npx tsx scripts/buildium/sync/sync-files-for-entity.ts lease 12345 <org-uuid>',
    );
    process.exit(1);
  }

  await ensureBuildiumEnabledForScript(orgId);

  // Validate entity type
  const validEntityTypes: BuildiumEntityType[] = [
    'property',
    'unit',
    'owner',
    'lease',
    'vendor',
    'bill',
    'task',
    'bank_account',
    'work_order',
  ];

  if (!validEntityTypes.includes(entityType)) {
    console.error(`Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`);
    process.exit(1);
  }

  try {
    console.log(`Starting Buildium files sync for ${entityType} ${entityId}`);

    // Step 1: Fetch files from Buildium
    const buildiumFiles = await fetchFilesFromBuildium(entityType, entityId);

    if (buildiumFiles.length === 0) {
      console.log('No files found in Buildium for this entity');
      return;
    }

    // Step 2: Sync to local database
    const result = await syncFilesToDatabase(buildiumFiles, orgId);

    // Step 3: Log results
    console.log({
      totalFetched: buildiumFiles.length,
      synced: result.synced,
      updated: result.updated,
      errors: result.errors,
    });

    if (result.errors > 0) {
      console.error(`Some files failed to sync (${result.errors} errors)`);
      process.exit(1);
    }

    console.log('Files sync completed successfully');
  } catch (error) {
    console.error('Files sync failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
