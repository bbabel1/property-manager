import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumWorkOrderCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabaseAdmin } from '@/lib/db';
import { mapWorkOrderFromBuildiumWithRelations } from '@/lib/buildium-mappers';

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
    const orderby = searchParams.get('orderby');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Call Edge: persist from Buildium then search locally
    const edgeParams: any = {}
    if (status) edgeParams.status = status
    if (priority) edgeParams.priority = priority
    if (propertyId) edgeParams.propertyId = Number(propertyId)
    if (unitId) edgeParams.unitId = Number(unitId)
    if (dateFrom) edgeParams.dateFrom = dateFrom
    if (dateTo) edgeParams.dateTo = dateTo
    if (limit) edgeParams.limit = Number(limit)
    if (offset) edgeParams.offset = Number(offset)

    await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'syncFromBuildium', entityData: edgeParams }
    })

    const { data, error } = await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'searchLocal', entityData: edgeParams }
    })
    if (error || !data?.success) {
      logger.error('Work orders search via Edge failed')
      return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data.data || [], count: data.count || 0 });

  } catch (error) {
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
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumWorkOrderCreateSchema);

    const { data, error } = await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'create', entityData: validatedData }
    })
    if (error || !data?.success) {
      logger.error('Buildium work order creation via Edge failed')
      return NextResponse.json({ error: data?.error || 'Failed to create work order' }, { status: 502 })
    }
    return NextResponse.json({ success: true, data: data.data }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium work order`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
