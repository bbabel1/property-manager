import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumResidentRequestCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest) {
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

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const supabaseAdmin = requireSupabaseAdmin('resident requests sync')

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
    const params: Record<string, string> = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (orderby) params.orderby = orderby;
    if (status) params.status = status;
    if (tenantId) params.tenantId = tenantId;
    if (propertyId) params.propertyId = propertyId;
    if (unitId) params.unitId = unitId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/rentals/residentrequests', params, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium resident requests fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch resident requests from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const residentRequests = response.json ?? [];

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
          const subject =
            typeof (localData as { subject?: unknown }).subject === 'string'
              ? (localData as { subject?: string }).subject
              : ''

          const { data: existing } = await supabaseAdmin
            .from('tasks')
            .select('id')
            .eq('buildium_task_id', buildiumId)
            .maybeSingle()

          const now = new Date().toISOString()
          if (existing?.id) {
            await supabaseAdmin
              .from('tasks')
              .update({ ...localData, subject, updated_at: now } as any)
              .eq('id', existing.id)
          } else {
            await supabaseAdmin
              .from('tasks')
              .insert({ ...localData, subject, created_at: now, updated_at: now } as any)
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

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const supabaseAdmin = requireSupabaseAdmin('resident requests sync')

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumResidentRequestCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/rentals/residentrequests', undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium resident request creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create resident request in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const residentRequest = response.json ?? {};

    logger.info(`Buildium resident request created successfully`);

    // Persist created Resident request to tasks
    try {
      const localData = await mapTaskFromBuildiumWithRelations(residentRequest, supabaseAdmin, {
        taskKind: 'resident',
      })
      const now = new Date().toISOString()
      const subject =
        typeof (localData as { subject?: unknown }).subject === 'string'
          ? (localData as { subject?: string }).subject
          : ''
      await supabaseAdmin
        .from('tasks')
        .insert({ ...localData, subject, created_at: now, updated_at: now } as any)
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
