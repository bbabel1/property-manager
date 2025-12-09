import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrg } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'financials.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const offeringId = searchParams.get('offeringId');
    const invoiced = searchParams.get('invoiced');

    if (!propertyId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'propertyId is required' } },
        { status: 400 },
      );
    }

    const { supabase } = auth;
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, org_id')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    const { supabase: supabaseOrg } = await requireOrg(String(property.org_id));

    let query = supabaseOrg
      .from('billing_events')
      .select(
        `
        id,
        property_id,
        unit_id,
        offering_id,
        plan_id,
        period_start,
        period_end,
        amount,
        source_basis,
        rent_basis,
        rent_amount,
        calculated_at,
        invoiced_at,
        transaction_id,
        service_offerings!inner(id, name)
      `,
      )
      .eq('property_id', propertyId)
      .order('period_start', { ascending: false })
      .order('calculated_at', { ascending: false })
      .limit(500);

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    if (offeringId) {
      query = query.eq('offering_id', offeringId);
    }

    if (invoiced === 'true') {
      query = query.not('invoiced_at', 'is', null);
    } else if (invoiced === 'false') {
      query = query.is('invoiced_at', null);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, 'Error fetching billing events');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load billing events' } },
        { status: 500 },
      );
    }

    // Transform to flatten service_offerings
    const transformed = (data || []).map((row: any) => ({
      id: row.id,
      property_id: row.property_id,
      unit_id: row.unit_id,
      offering_id: row.offering_id,
      offering_name: row.service_offerings?.name || 'Unknown',
      plan_id: row.plan_id,
      period_start: row.period_start,
      period_end: row.period_end,
      amount: Number(row.amount || 0),
      source_basis: row.source_basis,
      rent_basis: row.rent_basis,
      rent_amount: row.rent_amount ? Number(row.rent_amount) : null,
      calculated_at: row.calculated_at,
      invoiced_at: row.invoiced_at,
      transaction_id: row.transaction_id,
    }));

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/billing-events');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
