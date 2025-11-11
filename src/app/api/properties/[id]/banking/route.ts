import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabase, supabaseAdmin } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

const ADMIN_ROLE_SET = new Set(['org_admin', 'org_manager', 'platform_admin'])

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

    const client = supabaseAdmin || supabase;

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

    const {
      data: propertyRow,
      error: propertyFetchError,
    } = await client
      .from('properties')
      .select('id, org_id')
      .eq('id', propertyId)
      .maybeSingle();

    if (propertyFetchError) {
      logger.error(
        { error: propertyFetchError, userId: user.id, propertyId },
        'Failed to load property before banking update'
      );
      return NextResponse.json(
        { error: 'Failed to update banking details' },
        { status: 500 }
      );
    }

    if (!propertyRow) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const orgId = propertyRow.org_id;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Property missing organization context' },
        { status: 400 }
      );
    }

    const {
      data: membership,
      error: membershipError,
    } = await client
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (membershipError) {
      logger.error(
        { error: membershipError, userId: user.id, propertyId, orgId },
        'Failed to verify org membership before banking update'
      );
      return NextResponse.json(
        { error: 'Failed to update banking details' },
        { status: 500 }
      );
    }

    if (!membership || !ADMIN_ROLE_SET.has(String(membership.role))) {
      return NextResponse.json(
        { error: 'Not authorized to manage this property' },
        { status: 403 }
      );
    }

    // Update property banking details
    const { data, error } = await client
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
    // Reserve or account changes affect summary/financials; invalidate tags
    try {
      revalidateTag(`property-details:${propertyId}`)
      revalidateTag(`property-financials:${propertyId}`)
    } catch {}
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
