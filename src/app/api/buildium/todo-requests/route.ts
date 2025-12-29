import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumToDoRequestCreateSchema } from '@/schemas/buildium';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
type BuildiumToDoRequest = {
  Id?: number | string | null;
  RequestedByUserEntity?: { Type?: string | number | null } | null;
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('todo requests sync')
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
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query parameters for Buildium API
    const params: Record<string, string> = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (orderby) params.orderby = orderby;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (assignedTo) params.assignedTo = assignedTo;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', '/todorequests', params, undefined, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium to-do requests fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch to-do requests from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const toDoRequests = (response.json ?? []) as unknown;

    // Optional response filtering by RequestedByUserEntity.Type
    const requestedByTypeParam = searchParams.get('requestedByType');
    const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true';
    const requestedTypes = (requestedByTypeParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const toDoRequestArray: BuildiumToDoRequest[] = Array.isArray(toDoRequests) ? toDoRequests : [];
    const filtered =
      Array.isArray(toDoRequests) && requestedTypes.length > 0
        ? toDoRequestArray.filter((item) => {
            const t = item.RequestedByUserEntity?.Type;
            if (!t) return includeUnspecified;
            return requestedTypes.includes(String(t).toLowerCase());
          })
        : toDoRequests;

    // Persist to local tasks with task_kind='todo' and required category
    try {
      await Promise.all(
        toDoRequestArray.map(async (item) => {
          const normalized: BuildiumToDoRequest = {
            ...item,
            Id: typeof item?.Id === 'string' ? Number(item.Id) : item?.Id,
          };
          const localData = await mapTaskFromBuildiumWithRelations(normalized as any, supabaseAdmin, {
            taskKind: 'todo',
            requireCategory: true,
            defaultCategoryName: 'To-Do',
          })
          const buildiumIdRaw = normalized?.Id
          const buildiumId = buildiumIdRaw != null ? Number(buildiumIdRaw) : null
          if (!buildiumId || Number.isNaN(buildiumId)) return
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
      logger.warn({ err: String(persistErr) }, 'Failed to persist some To-Do requests to tasks')
    }

    logger.info(`Buildium to-do requests fetched successfully`);

    return NextResponse.json({
      success: true,
      data: filtered,
      count: Array.isArray(filtered) ? filtered.length : 0,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium to-do requests`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = requireSupabaseAdmin('todo requests sync')
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
    const validatedData = sanitizeAndValidate(body, BuildiumToDoRequestCreateSchema);

    // Make request to Buildium API
    const response = await buildiumFetch('POST', '/todorequests', undefined, validatedData, undefined);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium to-do request creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create to-do request in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const toDoRequest = response.json ?? {};
    const normalizedRequest = {
      ...toDoRequest,
      Id: typeof (toDoRequest as { Id?: unknown })?.Id === 'string' ? Number((toDoRequest as { Id?: string }).Id) : (toDoRequest as { Id?: number })?.Id,
    };

    logger.info(`Buildium to-do request created successfully`);

    // Persist created To-Do request to tasks
    try {
      const localData = await mapTaskFromBuildiumWithRelations(normalizedRequest as any, supabaseAdmin, {
        taskKind: 'todo',
        requireCategory: true,
        defaultCategoryName: 'To-Do',
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
      logger.warn({ err: String(persistErr) }, 'Failed to persist created To-Do request to tasks')
    }

    return NextResponse.json({
      success: true,
      data: toDoRequest,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium to-do request`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
