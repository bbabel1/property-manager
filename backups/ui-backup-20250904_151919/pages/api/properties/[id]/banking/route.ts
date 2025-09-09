import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireUser(request);
    const propertyId = resolvedParams.id;

    logger.info({ userId: user.id, propertyId, action: 'update_banking_details' }, 'Updating property banking details');

    // Parse request body
    const body = await request.json();
    const { reserve, operating_bank_account_id, deposit_trust_account_id } = body;

    // Validate required fields
    if (reserve === undefined) {
      return NextResponse.json(
        { error: 'Reserve amount is required' },
        { status: 400 }
      );
    }

    // Update property banking details
    const { data, error } = await supabase
      .from('properties')
      .update({
        reserve: reserve,
        operating_bank_account_id: operating_bank_account_id || null,
        deposit_trust_account_id: deposit_trust_account_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', propertyId)
      .select()
      .single();

    if (error) {
      logger.error({ error, userId: user.id, propertyId }, 'Error updating property banking details');
      return NextResponse.json(
        { error: 'Failed to update banking details' },
        { status: 500 }
      );
    }

    logger.info({ userId: user.id, propertyId }, 'Property banking details updated successfully');
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error updating property banking details');
    return NextResponse.json(
      { error: 'Failed to update banking details' },
      { status: 500 }
    );
  }
}
