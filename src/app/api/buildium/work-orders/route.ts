import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumWorkOrderCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabaseAdmin } from '@/lib/db';
import { mapWorkOrderFromBuildiumWithRelations as _mapWorkOrderFromBuildiumWithRelations } from '@/lib/buildium-mappers';

type BuildiumFunctionResponse<T> = {
  success?: boolean;
  data?: T | null;
  count?: number;
  error?: string | null;
};

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

    // Require platform admin (service-role sync)
    await requireRole('platform_admin');

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const _orderby = searchParams.get('orderby');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const _assignedTo = searchParams.get('assignedTo');
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const orderby = _orderby || undefined;
    const assignedTo = _assignedTo || undefined;

    // Call Edge: persist from Buildium then search locally
    const edgeParams: {
      status?: string;
      priority?: string;
      propertyId?: number;
      unitId?: number;
      dateFrom?: string;
      dateTo?: string;
      orderby?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    } = {}
    if (status) edgeParams.status = status
    if (priority) edgeParams.priority = priority
    if (propertyId) edgeParams.propertyId = Number(propertyId)
    if (unitId) edgeParams.unitId = Number(unitId)
    if (dateFrom) edgeParams.dateFrom = dateFrom
    if (dateTo) edgeParams.dateTo = dateTo
    if (orderby) edgeParams.orderby = orderby
    if (assignedTo) edgeParams.assignedTo = assignedTo
    if (limit) edgeParams.limit = Number(limit)
    if (offset) edgeParams.offset = Number(offset)

    await supabaseAdmin.functions.invoke<BuildiumFunctionResponse<unknown>>('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'syncFromBuildium', entityData: edgeParams }
    })

    const searchResult: { data: BuildiumFunctionResponse<unknown[]> | null; error: unknown } =
      await supabaseAdmin.functions.invoke<BuildiumFunctionResponse<unknown[]>>('buildium-sync', {
        body: { entityType: 'workOrder', operation: 'searchLocal', entityData: edgeParams }
      })
    const searchError = searchResult.error as { message?: unknown } | null
    const searchData = searchResult.data
    if (searchError || !searchData?.success) {
      logger.error('Work orders search via Edge failed')
      return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 })
    }

    const responseData = searchData.data ?? [];
    const count = typeof searchData.count === 'number'
      ? searchData.count
      : Array.isArray(responseData)
      ? responseData.length
      : 0;

    return NextResponse.json({ success: true, data: responseData || [], count });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium work orders`);

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

    // Require platform admin (service-role sync)
    await requireRole('platform_admin');

    // Parse and validate request body
    const body: unknown = await request.json().catch(() => ({}));
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumWorkOrderCreateSchema);

    const creationResult: { data: BuildiumFunctionResponse<unknown> | null; error: unknown } =
      await supabaseAdmin.functions.invoke<BuildiumFunctionResponse<unknown>>('buildium-sync', {
        body: { entityType: 'workOrder', operation: 'create', entityData: validatedData }
      })
    const creationError = creationResult.error as { message?: unknown } | null
    const creationData = creationResult.data
    if (creationError || !creationData?.success) {
      logger.error('Buildium work order creation via Edge failed')
      return NextResponse.json({ error: creationData?.error || 'Failed to create work order' }, { status: 502 })
    }
    return NextResponse.json({ success: true, data: creationData.data }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium work order`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
