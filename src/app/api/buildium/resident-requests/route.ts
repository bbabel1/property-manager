import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumResidentRequestCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers';

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('resident requests sync')
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (status) queryParams.append('status', status);
    if (tenantId) queryParams.append('tenantId', tenantId);
    if (propertyId) queryParams.append('propertyId', propertyId);
    if (unitId) queryParams.append('unitId', unitId);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/residentrequests?${queryParams.toString()}`;
    
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
      logger.error(`Buildium resident requests fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch resident requests from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const residentRequests = await response.json();

    // Optional response filtering by RequestedByUserEntity.Type
    const requestedByTypeParam = searchParams.get('requestedByType');
    const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true';
    const requestedTypes = (requestedByTypeParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const filtered = Array.isArray(residentRequests) && requestedTypes.length > 0
      ? residentRequests.filter((item) => {
          const t = (item as { RequestedByUserEntity?: { Type?: unknown } })?.RequestedByUserEntity?.Type;
          if (!t) return includeUnspecified;
          return requestedTypes.includes(String(t).toLowerCase());
        })
      : residentRequests;

    // Persist to local tasks with task_kind='resident'
    try {
      await Promise.all(
        (Array.isArray(residentRequests) ? residentRequests : []).map(async (item) => {
          const localData = await mapTaskFromBuildiumWithRelations(item, supabaseAdmin, {
            taskKind: 'resident',
          })
          const buildiumId = item?.Id
          if (!buildiumId) return

          const { data: existing } = await supabaseAdmin
            .from('tasks')
            .select('id')
            .eq('buildium_task_id', buildiumId)
            .maybeSingle()

          const now = new Date().toISOString()
          if (existing?.id) {
            await supabaseAdmin
              .from('tasks')
              .update({ ...localData, updated_at: now })
              .eq('id', existing.id)
          } else {
            await supabaseAdmin
              .from('tasks')
              .insert({ ...localData, created_at: now, updated_at: now })
          }
        })
      )
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist some Resident requests to tasks')
    }

    logger.info(`Buildium resident requests fetched successfully`);

    return NextResponse.json({
      success: true,
      data: filtered,
      count: Array.isArray(filtered) ? filtered.length : 0,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium resident requests`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('resident requests sync')
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

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumResidentRequestCreateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/residentrequests`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
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
      logger.error(`Buildium resident request creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create resident request in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const residentRequest = await response.json();

    logger.info(`Buildium resident request created successfully`);

    // Persist created Resident request to tasks
    try {
      const localData = await mapTaskFromBuildiumWithRelations(residentRequest, supabaseAdmin, {
        taskKind: 'resident',
      })
      const now = new Date().toISOString()
      await supabaseAdmin
        .from('tasks')
        .insert({ ...localData, created_at: now, updated_at: now })
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist created Resident request to tasks')
    }

    return NextResponse.json({
      success: true,
      data: residentRequest,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium resident request`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
