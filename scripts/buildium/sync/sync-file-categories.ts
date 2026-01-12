#!/usr/bin/env npx tsx
/**
 * Sync Buildium file categories to local database
 *
 * Usage: npx tsx scripts/buildium/sync/sync-file-categories.ts [orgId]
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { BuildiumFileCategory } from '@/types/buildium';
import { ensureBuildiumEnabledForScript } from '../ensure-enabled';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchFileCategoriesFromBuildium(): Promise<BuildiumFileCategory[]> {
  const allCategories: BuildiumFileCategory[] = [];
  let pageNumber = 1;
  const pageSize = 100;

  console.log('Starting to fetch file categories from Buildium...');

  while (true) {
    try {
      const url = `${process.env.BUILDIUM_BASE_URL}/filecategories?pageSize=${pageSize}&pageNumber=${pageNumber}`;

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
      let categories: BuildiumFileCategory[] = [];

      if (Array.isArray(result)) {
        categories = result;
      } else if (result.data && Array.isArray(result.data)) {
        categories = result.data;
      } else if (result.value && Array.isArray(result.value)) {
        categories = result.value;
      } else {
        throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
      }

      console.log(`Fetched page ${pageNumber} with ${categories.length} categories`);

      allCategories.push(...categories);

      // Check if we've fetched all pages
      if (categories.length < pageSize) {
        break;
      }

      pageNumber++;
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error);
      throw error;
    }
  }

  return allCategories;
}

async function syncCategoriesToDatabase(
  categories: BuildiumFileCategory[],
  orgId: string,
): Promise<{ synced: number; updated: number; errors: number }> {
  let synced = 0;
  let updated = 0;
  let errors = 0;

  console.log(`Syncing ${categories.length} categories to org ${orgId}...`);

  for (const category of categories) {
    try {
      // Check if category already exists
      const { data: existing } = await supabase
        .from('file_categories')
        .select('id')
        .eq('org_id', orgId)
        .eq('buildium_category_id', category.Id)
        .maybeSingle();

      const categoryData = {
        org_id: orgId,
        category_name: category.Name,
        buildium_category_id: category.Id,
        description: category.Description || null,
        is_active: category.IsActive ?? true,
      };

      if (existing) {
        // Update existing category
        const { error } = await supabase
          .from('file_categories')
          .update(categoryData)
          .eq('id', existing.id);

        if (error) throw error;
        updated++;
      } else {
        // Insert new category
        const { error } = await supabase.from('file_categories').insert(categoryData);

        if (error) throw error;
        synced++;
      }
    } catch (error) {
      console.error(`Error syncing category ${category.Id}:`, error);
      errors++;
    }
  }

  return { synced, updated, errors };
}

async function main() {
  const orgId = process.argv[2];

  if (!orgId) {
    console.error('Usage: npx tsx scripts/buildium/sync/sync-file-categories.ts <orgId>');
    process.exit(1);
  }

  await ensureBuildiumEnabledForScript(orgId);

  try {
    console.log('Starting Buildium file categories sync process');

    // Step 1: Fetch categories from Buildium
    const buildiumCategories = await fetchFileCategoriesFromBuildium();

    if (buildiumCategories.length === 0) {
      console.log('No file categories found in Buildium');
      return;
    }

    // Step 2: Sync to local database
    const result = await syncCategoriesToDatabase(buildiumCategories, orgId);

    // Step 3: Log results
    console.log({
      totalFetched: buildiumCategories.length,
      synced: result.synced,
      updated: result.updated,
      errors: result.errors,
    });

    if (result.errors > 0) {
      console.error(`Some categories failed to sync (${result.errors} errors)`);
      process.exit(1);
    }

    console.log('File categories sync completed successfully');
  } catch (error) {
    console.error('File categories sync failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
