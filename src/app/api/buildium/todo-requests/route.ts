import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumToDoRequestCreateSchema } from '@/schemas/buildium';
import { requireSupabaseAdmin } from '@/lib/supabase-client';
import { mapTaskFromBuildiumWithRelations } from '@/lib/buildium-mappers';
import { sanitizeAndValidate } from '@/lib/sanitize';

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
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (status) queryParams.append('status', status);
    if (priority) queryParams.append('priority', priority);
    if (assignedTo) queryParams.append('assignedTo', assignedTo);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/todorequests?${queryParams.toString()}`;
    
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
      logger.error(`Buildium to-do requests fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch to-do requests from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const toDoRequests = await response.json();

    // Optional response filtering by RequestedByUserEntity.Type
    const requestedByTypeParam = searchParams.get('requestedByType');
    const includeUnspecified = (searchParams.get('includeUnspecified') || 'false').toLowerCase() === 'true';
    const requestedTypes = (requestedByTypeParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const filtered = Array.isArray(toDoRequests) && requestedTypes.length > 0
      ? toDoRequests.filter((item: any) => {
          const t = item?.RequestedByUserEntity?.Type;
          if (!t) return includeUnspecified;
          return requestedTypes.includes(String(t).toLowerCase());
        })
      : toDoRequests;

    // Persist to local tasks with task_kind='todo' and required category
    try {
      await Promise.all(
        (Array.isArray(toDoRequests) ? toDoRequests : []).map(async (item: any) => {
          const localData = await mapTaskFromBuildiumWithRelations(item, supabaseAdmin, {
            taskKind: 'todo',
            requireCategory: true,
            defaultCategoryName: 'To-Do',
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
      logger.warn({ err: String(persistErr) }, 'Failed to persist some To-Do requests to tasks')
    }

    logger.info(`Buildium to-do requests fetched successfully`);

    return NextResponse.json({
      success: true,
      data: filtered,
      count: Array.isArray(filtered) ? filtered.length : 0,
    });

  } catch (error) {
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
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/todorequests`;
    
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
      logger.error(`Buildium to-do request creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create to-do request in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const toDoRequest = await response.json();

    logger.info(`Buildium to-do request created successfully`);

    // Persist created To-Do request to tasks
    try {
      const localData = await mapTaskFromBuildiumWithRelations(toDoRequest, supabaseAdmin, {
        taskKind: 'todo',
        requireCategory: true,
        defaultCategoryName: 'To-Do',
      })
      const now = new Date().toISOString()
      await supabaseAdmin
        .from('tasks')
        .insert({ ...localData, created_at: now, updated_at: now })
    } catch (persistErr) {
      logger.warn({ err: String(persistErr) }, 'Failed to persist created To-Do request to tasks')
    }

    return NextResponse.json({
      success: true,
      data: toDoRequest,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium to-do request`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
