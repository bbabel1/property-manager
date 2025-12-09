/**
 * Service Pricing API
 *
 * Handles CRUD operations for property/unit-level service pricing overrides
 * Part of Phase 2.3: Pricing Override Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrg } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'properties.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const offeringId = searchParams.get('offeringId');
    const effectiveDate = searchParams.get('effectiveDate') || new Date().toISOString();

    if (!propertyId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMETER', message: 'propertyId is required' } },
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

    // Build query
    let query = supabaseOrg
      .from('property_service_pricing')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .lte('effective_start', effectiveDate)
      .or(`effective_end.is.null,effective_end.gt.${effectiveDate}`)
      .order('effective_start', { ascending: false });

    if (unitId) {
      query = query.eq('unit_id', unitId);
    } else {
      query = query.is('unit_id', null);
    }

    if (offeringId) {
      query = query.eq('offering_id', offeringId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error, propertyId, unitId, offeringId }, 'Error fetching service pricing');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch service pricing' } },
        { status: 500 },
      );
    }

    // Deduplicate by offering_id, keeping most recent
    const deduplicated = (data || []).reduce(
      (acc, item) => {
        const existing = acc.find((i) => i.offering_id === item.offering_id);
        if (!existing || new Date(item.effective_start) > new Date(existing.effective_start)) {
          if (existing) {
            const index = acc.indexOf(existing);
            acc[index] = item;
          } else {
            acc.push(item);
          }
        }
        return acc;
      },
      [] as typeof data,
    );

    return NextResponse.json({ data: deduplicated });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/service-pricing');

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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'properties.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      property_id,
      unit_id,
      offering_id,
      billing_basis,
      rate,
      billing_frequency,
      min_amount,
      max_amount,
      bill_on,
      rent_basis,
      min_monthly_fee,
      markup_pct,
      markup_pct_cap,
      hourly_rate,
      hourly_min_hours,
      effective_start,
    } = body;

    // Validation
    if (!property_id || !offering_id || !billing_basis || !billing_frequency || !bill_on) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_PARAMETER',
            message:
              'Required fields: property_id, offering_id, billing_basis, billing_frequency, bill_on',
          },
        },
        { status: 400 },
      );
    }

    // Ensure rent_basis is set for percent_rent
    if (billing_basis === 'percent_rent' && !rent_basis) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'rent_basis is required when billing_basis is percent_rent',
          },
        },
        { status: 400 },
      );
    }

    const { supabase } = auth;
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, org_id')
      .eq('id', property_id)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    const { supabase: supabaseOrg } = await requireOrg(String(property.org_id));

    const effectiveStart = effective_start || new Date().toISOString();

    // End any existing active pricing for this property/unit/offering
    const endQuery = supabaseOrg
      .from('property_service_pricing')
      .update({ effective_end: effectiveStart })
      .eq('property_id', property_id)
      .eq('offering_id', offering_id)
      .eq('is_active', true)
      .is('effective_end', null);

    const { error: endError } = unit_id
      ? await endQuery.eq('unit_id', unit_id)
      : await endQuery.is('unit_id', null);

    if (endError && endError.code !== 'PGRST116') {
      logger.error({ error: endError }, 'Error ending existing pricing');
      // Continue anyway - this is not critical
    }

    // Create new pricing record
    const { data, error } = await supabaseOrg
      .from('property_service_pricing')
      .insert({
        property_id,
        unit_id: unit_id || null,
        offering_id,
        billing_basis,
        rate: rate || null,
        billing_frequency,
        min_amount: min_amount || null,
        max_amount: max_amount || null,
        bill_on,
        rent_basis: rent_basis || null,
        min_monthly_fee: min_monthly_fee || null,
        markup_pct: markup_pct || null,
        markup_pct_cap: markup_pct_cap || null,
        hourly_rate: hourly_rate || null,
        hourly_min_hours: hourly_min_hours || null,
        is_active: true,
        effective_start: effectiveStart,
        effective_end: null,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, body }, 'Error creating service pricing');
      return NextResponse.json(
        { error: { code: 'CREATION_FAILED', message: 'Failed to create service pricing' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/service-pricing');

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

export async function PUT(request: NextRequest) {
  // PUT is same as POST - creates new effective-dated record
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'properties.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { supabase } = auth;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    const offeringId = searchParams.get('offeringId');

    if (!propertyId || !offeringId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMETER', message: 'propertyId and offeringId are required' } },
        { status: 400 },
      );
    }

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

    // Deactivate pricing by setting effective_end to now
    const now = new Date().toISOString();

    const deactivate = supabaseOrg
      .from('property_service_pricing')
      .update({ effective_end: now, is_active: false })
      .eq('property_id', propertyId)
      .eq('offering_id', offeringId)
      .is('effective_end', null);

    const { error } = unitId
      ? await deactivate.eq('unit_id', unitId)
      : await deactivate.is('unit_id', null);

    if (error) {
      logger.error({ error, propertyId, unitId, offeringId }, 'Error deactivating service pricing');
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to deactivate service pricing' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in DELETE /api/service-pricing');

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
