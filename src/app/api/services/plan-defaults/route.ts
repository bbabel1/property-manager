import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/db';

const PLAN_DEFAULT_COLUMNS = `
  service_plan,
  offering_id,
  billing_basis,
  default_rate,
  default_freq,
  min_amount,
  max_amount,
  bill_on,
  rent_basis,
  min_monthly_fee,
  plan_fee_percent,
  markup_pct,
  markup_pct_cap,
  hourly_rate,
  hourly_min_hours,
  is_included,
  is_required,
  service_offerings!inner(name)
`;

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPlanDefaultPayload = (body: Record<string, any>) => {
  const payload: Record<string, any> = {};
  const set = (key: string, value: any) => {
    if (value !== undefined) payload[key] = value;
  };

  set('billing_basis', body.billing_basis);
  set('default_rate', parseNumber(body.default_rate));
  set('default_freq', body.default_freq);
  set('min_amount', parseNumber(body.min_amount));
  set('max_amount', parseNumber(body.max_amount));
  set('bill_on', body.bill_on);
  set('rent_basis', body.rent_basis);
  set('min_monthly_fee', parseNumber(body.min_monthly_fee));
  set('plan_fee_percent', parseNumber(body.plan_fee_percent));
  set('markup_pct', parseNumber(body.markup_pct));
  set('markup_pct_cap', parseNumber(body.markup_pct_cap));
  set('hourly_rate', parseNumber(body.hourly_rate));
  set('hourly_min_hours', parseNumber(body.hourly_min_hours));
  set('is_included', typeof body.is_included === 'boolean' ? body.is_included : undefined);
  set('is_required', typeof body.is_required === 'boolean' ? body.is_required : undefined);

  return payload;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    const canReadPlanDefaults =
      hasPermission(roles, 'settings.read') ||
      hasPermission(roles, 'settings.write') ||
      hasPermission(roles, 'properties.read');

    if (!canReadPlanDefaults) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const { searchParams } = new URL(request.url);
    const planFilter = searchParams.get('plan');

    let query = supabase.from('service_plan_default_pricing').select(PLAN_DEFAULT_COLUMNS);

    if (planFilter) {
      query = query.eq('service_plan', planFilter);
    }

    const { data: defaults, error } = await query
      .order('service_plan')
      .order('service_offerings(name)');

    if (error) {
      logger.error({ error, orgId, userId: user.id }, 'Error fetching plan defaults');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch plan defaults' } },
        { status: 500 },
      );
    }

    const transformed = (defaults || []).map((d: any) => ({
      service_plan: d.service_plan,
      offering_id: d.offering_id,
      offering_name: d.service_offerings?.name || 'Unknown',
      billing_basis: d.billing_basis,
      default_rate: d.default_rate,
      plan_fee_percent: d.plan_fee_percent,
      min_monthly_fee: d.min_monthly_fee,
      default_freq: d.default_freq,
      bill_on: d.bill_on,
      rent_basis: d.rent_basis,
      min_amount: d.min_amount,
      max_amount: d.max_amount,
      markup_pct: d.markup_pct,
      markup_pct_cap: d.markup_pct_cap,
      hourly_rate: d.hourly_rate,
      hourly_min_hours: d.hourly_min_hours,
      is_included: d.is_included,
      is_required: d.is_required,
    }));

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/plan-defaults');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
          { status: 403 },
        );
      }
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
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);

    const body = await request.json();
    const { service_plan, offering_id } = body;

    if (!service_plan || !offering_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'service_plan and offering_id are required' } },
        { status: 400 },
      );
    }

    const payload = buildPlanDefaultPayload(body);

    if (!payload.billing_basis || !payload.default_freq || !payload.bill_on) {
      const { data: offering } = await supabaseAdmin
        .from('service_offerings')
        .select('billing_basis, default_freq, bill_on, default_rent_basis, default_rate, min_amount, max_amount')
        .eq('id', offering_id)
        .maybeSingle();

      payload.billing_basis = payload.billing_basis || offering?.billing_basis;
      payload.default_freq = payload.default_freq || offering?.default_freq;
      payload.bill_on = payload.bill_on || offering?.bill_on;
      payload.rent_basis = payload.rent_basis || offering?.default_rent_basis || null;
      if (payload.default_rate === undefined && offering) payload.default_rate = offering.default_rate;
      if (payload.min_amount === undefined && offering) payload.min_amount = offering.min_amount;
      if (payload.max_amount === undefined && offering) payload.max_amount = offering.max_amount;
    }

    if (!payload.billing_basis || !payload.default_freq || !payload.bill_on) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'billing_basis, default_freq, and bill_on are required to create plan defaults',
          },
        },
        { status: 400 },
      );
    }

    if (payload.billing_basis === 'percent_rent' && !payload.rent_basis) {
      payload.rent_basis = 'scheduled';
    }

    const { data, error } = await supabaseAdmin
      .from('service_plan_default_pricing')
      .upsert(
        {
          service_plan,
          offering_id,
          ...payload,
        },
        { onConflict: 'service_plan,offering_id' },
      )
      .select(PLAN_DEFAULT_COLUMNS)
      .single();

    if (error) {
      logger.error({ error, userId: user.id }, 'Error saving plan default');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to save plan default' } },
        { status: 500 },
      );
    }

    const transformed = {
      service_plan: data.service_plan,
      offering_id: data.offering_id,
      offering_name: data.service_offerings?.name || 'Unknown',
      billing_basis: data.billing_basis,
      default_rate: data.default_rate,
      plan_fee_percent: data.plan_fee_percent,
      min_monthly_fee: data.min_monthly_fee,
      default_freq: data.default_freq,
      bill_on: data.bill_on,
      rent_basis: data.rent_basis,
      min_amount: data.min_amount,
      max_amount: data.max_amount,
      markup_pct: data.markup_pct,
      markup_pct_cap: data.markup_pct_cap,
      hourly_rate: data.hourly_rate,
      hourly_min_hours: data.hourly_min_hours,
      is_included: data.is_included,
      is_required: data.is_required,
    };

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/services/plan-defaults');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);

    const body = await request.json();
    const { service_plan, offering_id } = body;

    if (!service_plan || !offering_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'service_plan and offering_id are required' } },
        { status: 400 },
      );
    }

    const payload = buildPlanDefaultPayload(body);
    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'No fields to update' } },
        { status: 400 },
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('service_plan_default_pricing')
      .select('service_plan, offering_id')
      .eq('service_plan', service_plan)
      .eq('offering_id', offering_id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Plan default not found' } },
        { status: 404 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('service_plan_default_pricing')
      .update(payload)
      .eq('service_plan', service_plan)
      .eq('offering_id', offering_id)
      .select(PLAN_DEFAULT_COLUMNS)
      .single();

    if (error) {
      logger.error({ error, userId: user.id }, 'Error updating plan default');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update plan default' } },
        { status: 500 },
      );
    }

    const transformed = {
      service_plan: data.service_plan,
      offering_id: data.offering_id,
      offering_name: data.service_offerings?.name || 'Unknown',
      billing_basis: data.billing_basis,
      default_rate: data.default_rate,
      plan_fee_percent: data.plan_fee_percent,
      min_monthly_fee: data.min_monthly_fee,
      default_freq: data.default_freq,
      bill_on: data.bill_on,
      rent_basis: data.rent_basis,
      min_amount: data.min_amount,
      max_amount: data.max_amount,
      markup_pct: data.markup_pct,
      markup_pct_cap: data.markup_pct_cap,
      hourly_rate: data.hourly_rate,
      hourly_min_hours: data.hourly_min_hours,
      is_included: data.is_included,
      is_required: data.is_required,
    };

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error({ error }, 'Error in PUT /api/services/plan-defaults');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
