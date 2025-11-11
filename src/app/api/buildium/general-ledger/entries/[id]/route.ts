import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumGeneralLedgerEntryUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    const { id } = await params;

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { method: 'GET', entityType: 'glEntry', entityId: id }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const entry = data?.data || data

    logger.info(`Buildium general ledger entry fetched successfully`);

    return NextResponse.json({
      success: true,
      data: entry,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium general ledger entry`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumGeneralLedgerEntryUpdateSchema);

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { entityType: 'glEntry', operation: 'update', entityData: { Id: Number(id), ...validatedData } }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const entry = data?.data || data

    logger.info(`Buildium general ledger entry updated successfully`);

    return NextResponse.json({
      success: true,
      data: entry,
    });

  } catch (error) {
    logger.error(`Error updating Buildium general ledger entry`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
