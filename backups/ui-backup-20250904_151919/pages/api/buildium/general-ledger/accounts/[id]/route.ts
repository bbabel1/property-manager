import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumGeneralLedgerAccountUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import supabase from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser();
    const { id } = params;

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { method: 'GET', entityType: 'glAccount', entityId: id }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = data?.data || data
    logger.info('Buildium GL account fetched successfully');
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    logger.error('Error fetching Buildium GL account');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireUser();
    const { id } = params;
    const body = await request.json();
    const validatedData = sanitizeAndValidate(body, BuildiumGeneralLedgerAccountUpdateSchema);

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { entityType: 'glAccount', operation: 'update', entityData: { Id: Number(id), ...validatedData } }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payload = data?.data || data
    logger.info('Buildium GL account updated successfully');
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    logger.error('Error updating Buildium GL account');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
