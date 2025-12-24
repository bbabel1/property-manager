import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumWorkOrderUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabaseAdmin } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { data, error } = await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'get', entityData: { id: Number(id) } }
    })
    if (error || !data?.success) {
      logger.error('Buildium work order fetch via Edge failed')
      return NextResponse.json({ error: data?.error || 'Failed to fetch work order' }, { status: 502 })
    }

    logger.info(`Buildium work order fetched successfully`);

    return NextResponse.json({
      success: true,
      data: data.data,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium work order`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumWorkOrderUpdateSchema);

    const { data, error } = await supabaseAdmin.functions.invoke('buildium-sync', {
      body: { entityType: 'workOrder', operation: 'update', entityData: { ...validatedData, Id: Number(id), buildium_work_order_id: Number(id) } }
    })
    if (error || !data?.success) {
      logger.error('Buildium work order update via Edge failed')
      return NextResponse.json({ error: data?.error || 'Failed to update work order' }, { status: 502 })
    }

    // Persist updated work order to DB (upsert by buildium_work_order_id)
    // Now handled inside Edge function

    logger.info(`Buildium work order updated successfully`);

    return NextResponse.json({
      success: true,
      data: data.data,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium work order`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
