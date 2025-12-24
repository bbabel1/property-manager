import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumFileCategoryCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { BuildiumFileCategory } from '@/types/buildium';
import type { Database } from '@/types/database';

type FileCategoryRow = Database['public']['Tables']['file_categories']['Row'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export async function GET(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Require platform admin
    const { user } = await requireRole('platform_admin');

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/filecategories?${queryParams.toString()}`;

    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({}));
      logger.error(`Buildium file categories fetch failed`);

      return NextResponse.json(
        {
          error: 'Failed to fetch file categories from Buildium',
          details: errorData,
        },
        { status: response.status },
      );
    }

    const rawPayload: unknown = await response.json().catch(() => []);
    const payloadObject = isRecord(rawPayload) ? rawPayload : null;

    let categories: BuildiumFileCategory[] = [];
    if (Array.isArray(rawPayload)) {
      categories = rawPayload as BuildiumFileCategory[];
    } else if (payloadObject && Array.isArray(payloadObject.data)) {
      categories = payloadObject.data as BuildiumFileCategory[];
    } else if (payloadObject && Array.isArray(payloadObject.value)) {
      categories = payloadObject.value as BuildiumFileCategory[];
    } else if (payloadObject && 'items' in payloadObject && Array.isArray((payloadObject as { items?: unknown }).items)) {
      categories = (payloadObject as { items: unknown[] }).items as BuildiumFileCategory[];
    } else {
      logger.warn(
        {
          payloadType: typeof rawPayload,
          keys: payloadObject ? Object.keys(payloadObject) : null,
        },
        'Unexpected Buildium file categories response shape',
      );
      categories = [];
    }

    logger.info(`Buildium file categories fetched successfully`);

    // Optionally sync to local database if sync=true query param
    const sync = searchParams.get('sync') === 'true';
    if (sync && Array.isArray(categories)) {
      try {
        const supabase = await getSupabaseServerClient();
        const metadata = isRecord(user?.user_metadata) ? user.user_metadata : null;
        const orgId =
          searchParams.get('orgId') ||
          request.headers.get('x-org-id') ||
          (metadata && typeof metadata.org_id === 'string' ? metadata.org_id : undefined) ||
          (Array.isArray(metadata?.org_ids) ? String(metadata.org_ids[0]) : undefined);

        if (!orgId) {
          return NextResponse.json(
            { error: 'Organization context required to sync categories' },
            { status: 400 },
          );
        }

        // Fetch existing category ids for the org
        const { data: existingRows, error: existingErr } = await supabase
          .from('file_categories')
          .select('id, buildium_category_id')
          .eq('org_id', orgId);

        if (existingErr) {
          throw existingErr;
        }

        const existingMap = new Map<number, string>();
        (existingRows || []).forEach((row) => {
          if (row.buildium_category_id != null) {
            existingMap.set(row.buildium_category_id, row.id);
          }
        });

        const maxCreates = 5;
        let createdCount = 0;
        let updatedCount = 0;
        const createdRecords: FileCategoryRow[] = [];
        const updatedRecords: FileCategoryRow[] = [];

        for (const category of categories) {
          if (!category || typeof category.Id !== 'number') continue;

          const categoryName = typeof category.Name === 'string' && category.Name.trim()
            ? category.Name.trim()
            : `Category ${category.Id}`;

          const description =
            typeof category.Description === 'string' && category.Description.trim()
              ? category.Description.trim()
              : null;

          const isActive = category.IsActive ?? true;
          const existingId = existingMap.get(category.Id);

          if (existingId) {
            const { data: updatedRow, error: updateErr } = await supabase
              .from('file_categories')
              .update({
                category_name: categoryName,
                description,
                is_active: isActive,
              })
              .eq('id', existingId)
              .select('*')
              .single();

            if (updateErr) {
              throw updateErr;
            }
            if (updatedRow) {
              updatedRecords.push(updatedRow);
              updatedCount++;
            }
          } else if (createdCount < maxCreates) {
            const { data: insertedRow, error: insertErr } = await supabase
              .from('file_categories')
              .insert({
                org_id: orgId,
                buildium_category_id: category.Id,
                category_name: categoryName,
                description,
                is_active: isActive,
              })
              .select('*')
              .single();

            if (insertErr) {
              throw insertErr;
            }
            if (insertedRow) {
              createdRecords.push(insertedRow);
              existingMap.set(category.Id, insertedRow.id);
              createdCount++;
            }
          }
        }

        logger.info({
          orgId,
          createdCount,
          updatedCount,
        }, 'Buildium file categories synced to database');

        return NextResponse.json({
          success: true,
          data: categories,
          count: categories.length,
          synced: {
            orgId,
            created: createdCount,
            updated: updatedCount,
            createdRecords,
            updatedRecords,
          },
        });
      } catch (syncError) {
        logger.error({ error: syncError }, 'Error syncing file categories to local DB');
        return NextResponse.json(
          {
            error: 'Failed to sync Buildium file categories',
            details:
              syncError instanceof Error
                ? syncError.message
                : typeof syncError === 'object'
                ? String(syncError)
                : syncError,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: categories,
      count: Array.isArray(categories) ? categories.length : 0,
    });
  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium file categories`);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Require platform admin
    const { user: _user } = await requireRole('platform_admin');

    // Parse and validate request body
    const body: unknown = await request.json().catch(() => ({}));

    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumFileCategoryCreateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/filecategories`;

    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({}));
      logger.error(`Buildium file category creation failed`);

      return NextResponse.json(
        {
          error: 'Failed to create file category in Buildium',
          details: errorData,
        },
        { status: response.status },
      );
    }

    const categoryJson: unknown = await response.json().catch(() => ({}));
    const category =
      categoryJson && typeof categoryJson === 'object'
        ? (categoryJson as Record<string, unknown>)
        : {};

    logger.info(`Buildium file category created successfully`);

    return NextResponse.json(
      {
        success: true,
        data: category,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium file category`);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
