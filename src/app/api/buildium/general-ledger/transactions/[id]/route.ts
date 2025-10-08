import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Require authentication
    const user = await requireUser();

    const { id } = params;

    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: { method: 'GET', entityType: 'glTransaction', entityId: id }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const transaction = data?.data || data

    logger.info(`Buildium general ledger transaction fetched successfully`);

    return NextResponse.json({
      success: true,
      data: transaction,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium general ledger transaction`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
