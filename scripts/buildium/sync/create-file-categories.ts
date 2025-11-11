#!/usr/bin/env npx tsx
/**
 * Fetch file categories from Buildium and create new records in database (max 5)
 *
 * Usage: npx tsx scripts/buildium/sync/create-file-categories.ts [orgId]
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { BuildiumFileCategory } from '@/types/buildium';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchFileCategoriesFromBuildium(): Promise<BuildiumFileCategory[]> {
  console.log('Fetching file categories from Buildium...');

  // Use limit/offset query params
  const queryParams = new URLSearchParams();
  queryParams.append('limit', '50');
  queryParams.append('offset', '0');

  const url = `${process.env.BUILDIUM_BASE_URL}/files/categories?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Buildium API error details:', errorData);
    throw new Error(
      `Buildium API error: ${response.status} ${response.statusText}. Details: ${JSON.stringify(errorData)}`,
    );
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
  } else if (result.items && Array.isArray(result.items)) {
    categories = result.items;
  } else {
    throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
  }

  console.log(`Fetched ${categories.length} file categories from Buildium`);
  return categories;
}

async function getOrgId(providedOrgId?: string): Promise<string> {
  if (providedOrgId) {
    // Verify the org exists
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', providedOrgId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(`Organization ${providedOrgId} not found`);
    }

    return providedOrgId;
  }

  // Get first available org
  const { data, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle();

  if (error || !data) {
    throw new Error(
      'No organizations found. Please provide an orgId or create an organization first.',
    );
  }

  console.log(`Using organization: ${data.id}`);
  return data.id;
}

async function createNewCategories(
  categories: BuildiumFileCategory[],
  orgId: string,
): Promise<{ created: number; skipped: number; errors: number; createdRecords: any[] }> {
  const MAX_CREATES = 5;
  let created = 0;
  let skipped = 0;
  let errors = 0;
  const createdRecords: any[] = [];

  console.log(`Checking existing categories for org ${orgId}...`);

  // Get existing category IDs for this org
  const { data: existingCategories, error: fetchError } = await supabase
    .from('file_categories')
    .select('buildium_category_id')
    .eq('org_id', orgId);

  if (fetchError) {
    throw new Error(`Failed to fetch existing categories: ${fetchError.message}`);
  }

  const existingIds = new Set(
    (existingCategories || [])
      .map((cat) => cat.buildium_category_id)
      .filter((id): id is number => id !== null),
  );

  console.log(`Found ${existingIds.size} existing categories`);

  // Filter to only new categories
  const newCategories = categories.filter((cat) => !existingIds.has(cat.Id));

  console.log(`Found ${newCategories.length} new categories to create (max ${MAX_CREATES})`);

  // Create up to MAX_CREATES new categories
  for (const category of newCategories) {
    if (created >= MAX_CREATES) {
      console.log(`Reached maximum of ${MAX_CREATES} new records. Stopping.`);
      break;
    }

    try {
      if (!category.Id || typeof category.Id !== 'number') {
        console.warn(`Skipping category with invalid ID:`, category);
        skipped++;
        continue;
      }

      const categoryName =
        typeof category.Name === 'string' && category.Name.trim()
          ? category.Name.trim()
          : `Category ${category.Id}`;

      const categoryData = {
        org_id: orgId,
        category_name: categoryName,
        buildium_category_id: category.Id,
        description:
          typeof category.Description === 'string' && category.Description.trim()
            ? category.Description.trim()
            : null,
        is_active: category.IsActive ?? true,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('file_categories')
        .insert(categoryData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      created++;
      createdRecords.push(inserted);
      console.log(`✓ Created category: ${categoryName} (Buildium ID: ${category.Id})`);
    } catch (error) {
      console.error(`✗ Error creating category ${category.Id}:`, error);
      errors++;
    }
  }

  return { created, skipped, errors, createdRecords };
}

async function main() {
  const orgIdArg = process.argv[2];

  try {
    console.log('Starting Buildium file categories creation process...\n');

    // Step 1: Get or resolve org_id
    const orgId = await getOrgId(orgIdArg);
    console.log(`Using organization ID: ${orgId}\n`);

    // Step 2: Fetch categories from Buildium
    const buildiumCategories = await fetchFileCategoriesFromBuildium();

    if (buildiumCategories.length === 0) {
      console.log('No file categories found in Buildium');
      return;
    }

    // Step 3: Create new categories (max 5)
    const result = await createNewCategories(buildiumCategories, orgId);

    // Step 4: Log results
    console.log('\n=== Results ===');
    console.log(`Total fetched from Buildium: ${buildiumCategories.length}`);
    console.log(`New categories created: ${result.created}`);
    console.log(`Categories skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors}`);

    if (result.createdRecords.length > 0) {
      console.log('\nCreated records:');
      result.createdRecords.forEach((record) => {
        console.log(
          `  - ${record.category_name} (ID: ${record.id}, Buildium ID: ${record.buildium_category_id})`,
        );
      });
    }

    if (result.errors > 0) {
      console.error(`\n⚠️  ${result.errors} categories failed to create`);
      process.exit(1);
    }

    console.log('\n✓ File categories creation completed successfully');
  } catch (error) {
    console.error('\n✗ File categories creation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
