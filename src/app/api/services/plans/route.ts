import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';

const DEFAULT_PLAN_NAMES = ['Full', 'Basic', 'A-la-carte', 'Custom'];

type BillingFrequency = Database['public']['Enums']['billing_frequency_enum'];
type PlanAmountType = Database['public']['Enums']['plan_amount_type'];
type PlanPercentBasis = Database['public']['Enums']['plan_percent_basis'];
type BillingBasis = Database['public']['Enums']['billing_basis_enum'];
type RentBasis = Database['public']['Enums']['rent_basis_enum'];
type ServicePlanServiceInsert = Database['public']['Tables']['service_plan_services']['Insert'];

const BILLING_FREQUENCIES: BillingFrequency[] = [
  'Annual',
  'Monthly',
  'monthly',
  'annually',
  'one_time',
  'per_event',
  'per_job',
  'quarterly',
];
const FALLBACK_FREQUENCY: BillingFrequency = 'monthly';

function isALaCartePlanName(name: string) {
  return name.trim().toLowerCase() === 'a-la-carte';
}

function isMissingColumnError(error: unknown) {
  const code = (error as { code?: unknown })?.code ? String((error as { code?: unknown }).code) : '';
  const message = (error as { message?: unknown })?.message
    ? String((error as { message?: unknown }).message)
    : '';
  return code === '42703' || /column .* does not exist/i.test(message);
}

const OFFERING_SELECTS = [
  'id, default_freq, markup_pct, markup_pct_cap, hourly_rate, hourly_min_hours' as const,
  'id, default_freq' as const,
  'id' as const,
];

function normalizeBillingFrequency(value: BillingFrequency | null | undefined): BillingFrequency {
  if (!value) return FALLBACK_FREQUENCY;
  const normalized = String(value).toLowerCase();
  const match = BILLING_FREQUENCIES.find((freq) => freq.toLowerCase() === normalized);
  return match ?? FALLBACK_FREQUENCY;
}

function isPlanAmountType(value: unknown): value is PlanAmountType {
  return value === 'flat' || value === 'percent';
}

function isPlanPercentBasis(value: unknown): value is PlanPercentBasis {
  return value === 'lease_rent_amount' || value === 'collected_rent';
}

type OfferingRow = Pick<
  Database['public']['Tables']['service_offerings']['Row'],
  'id' | 'default_freq' | 'markup_pct' | 'markup_pct_cap' | 'hourly_rate' | 'hourly_min_hours'
> & {
  billing_basis?: BillingBasis | null;
  default_rent_basis?: RentBasis | null;
};

async function loadOfferingsForPlanAssignment(offeringIds: string[]) {
  const tries = OFFERING_SELECTS;

  for (const select of tries) {
    const { data, error } = await supabaseAdmin
      .from('service_offerings')
      .select(select)
      .in('id', offeringIds);

    if (!error) return (data as OfferingRow[]) || [];
    if (!isMissingColumnError(error)) throw error;
  }

  return [];
}

async function ensureDefaultPlans(orgId: string, userId: string) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('service_plans')
      .select('id, name')
      .eq('org_id', orgId);

    // Seed defaults only for brand-new orgs with zero plans; avoid recreating
    // deleted plans on every fetch.
    if (!existing || existing.length === 0) {
      const inserts = DEFAULT_PLAN_NAMES.map((name) => ({
        org_id: orgId,
        name,
        amount_type: 'flat',
        percent_basis: null,
        is_active: true,
        // default_fee_* intentionally omitted; A-la-carte should have no plan-level fee.
      }));

      if (inserts.length) {
        await supabaseAdmin.from('service_plans').insert(inserts);
      }
    }
  } catch (err) {
    logger.warn({ err, orgId, userId }, 'Failed to ensure default plans');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    const canRead =
      hasPermission(roles, 'settings.read') ||
      hasPermission(roles, 'settings.write') ||
      hasPermission(roles, 'properties.read');

    if (!canRead) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('id');

    await ensureDefaultPlans(orgId, user.id);

    if (planId) {
      const { data: plan, error: planError } = await supabase
        .from('service_plans')
        .select(
          'id, name, amount_type, percent_basis, is_active, gl_account_id, default_fee_amount, default_fee_percent',
        )
        .eq('org_id', orgId)
        .eq('id', planId)
        .maybeSingle();

      if (planError) {
        logger.error({ error: planError, userId: user.id, orgId, planId }, 'Error fetching plan');
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to fetch service plan' } },
          { status: 500 },
        );
      }

      if (!plan) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Plan not found' } },
          { status: 404 },
        );
      }

      const { data: services, error: servicesError } = await supabase
        .from('service_plan_services')
        .select('offering_id')
        .eq('plan_id', planId);

      if (servicesError) {
        logger.error(
          { error: servicesError, userId: user.id, orgId, planId },
          'Error fetching plan services',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to fetch plan services' } },
          { status: 500 },
        );
      }

      return NextResponse.json({
        data: plan,
        offering_ids: (services || []).map((r) => String(r.offering_id)),
      });
    }

    const { data, error } = await supabase
      .from('service_plans')
      .select(
        'id, name, amount_type, percent_basis, is_active, gl_account_id, default_fee_amount, default_fee_percent',
      )
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      logger.error({ error, userId: user.id, orgId }, 'Error fetching service plans');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch service plans' } },
        { status: 500 },
      );
    }

    const planRows = data || [];
    const planIds = planRows.map((plan) => String(plan.id)).filter(Boolean);

    if (!planIds.length) {
      return NextResponse.json({ data: planRows });
    }

    const { data: planServices, error: planServicesError } = await supabase
      .from('service_plan_services')
      .select('plan_id, offering_id')
      .in('plan_id', planIds);

    if (planServicesError) {
      // Degrade gracefully: clients that need offering_ids can fall back to fetching
      // an individual plan via `?id=...`.
      logger.warn(
        { error: planServicesError, userId: user.id, orgId, planCount: planIds.length },
        'Error fetching plan services for plan list',
      );
      return NextResponse.json({ data: planRows });
    }

    const offeringIdsByPlanId = new Map<string, string[]>();
    for (const row of planServices || []) {
      const planId = row?.plan_id ? String(row.plan_id) : '';
      const offeringId = row?.offering_id ? String(row.offering_id) : '';
      if (!planId || !offeringId) continue;
      const next = offeringIdsByPlanId.get(planId) || [];
      next.push(offeringId);
      offeringIdsByPlanId.set(planId, next);
    }

    const enriched = planRows.map((plan) => {
      const id = String(plan.id);
      const offeringIds = offeringIdsByPlanId.get(id) || [];
      return { ...plan, offering_ids: offeringIds };
    });

    return NextResponse.json({ data: enriched });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/plans');
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
    const { supabase, user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const body = await request.json().catch(() => ({}));
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'name is required' } },
        { status: 400 },
      );
    }

    const isALaCarte = isALaCartePlanName(name);
    const rawAmountType = body.amount_type;
    const amountType: PlanAmountType = isALaCarte
      ? 'flat'
      : isPlanAmountType(rawAmountType)
        ? rawAmountType
        : 'flat';
    const rawPercentBasis = body.percent_basis;
    const percentBasis: PlanPercentBasis | null =
      amountType === 'percent'
        ? isPlanPercentBasis(rawPercentBasis)
          ? rawPercentBasis
          : 'lease_rent_amount'
        : null;
    if (amountType === 'percent' && !percentBasis) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'percent_basis is required for percent plans' } },
        { status: 400 },
      );
    }

    const defaultFeeAmount = isALaCarte
      ? null
      : body.default_fee_amount === '' || body.default_fee_amount === undefined
        ? null
        : Number(body.default_fee_amount);
    const defaultFeePercent = isALaCarte
      ? null
      : body.default_fee_percent === '' || body.default_fee_percent === undefined
        ? null
        : Number(body.default_fee_percent);

    if (!isALaCarte) {
      if (amountType === 'flat') {
        if (defaultFeeAmount === null || !Number.isFinite(defaultFeeAmount)) {
          return NextResponse.json(
            {
              error: {
                code: 'BAD_REQUEST',
                message: 'default_fee_amount is required for flat plans',
              },
            },
            { status: 400 },
          );
        }
      }
      if (amountType === 'percent') {
        if (defaultFeePercent === null || !Number.isFinite(defaultFeePercent)) {
          return NextResponse.json(
            {
              error: {
                code: 'BAD_REQUEST',
                message: 'default_fee_percent is required for percent plans',
              },
            },
            { status: 400 },
          );
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('service_plans')
      .insert({
        org_id: orgId,
        name,
        amount_type: amountType,
        percent_basis: amountType === 'percent' ? percentBasis : null,
        is_active: body.is_active ?? true,
        gl_account_id: isALaCarte ? null : body.gl_account_id ?? null,
        default_fee_amount: amountType === 'flat' ? defaultFeeAmount : null,
        default_fee_percent: amountType === 'percent' ? defaultFeePercent : null,
      })
      .select(
        'id, name, amount_type, percent_basis, is_active, gl_account_id, default_fee_amount, default_fee_percent',
      )
      .single();

    if (error) {
      logger.error({ error, orgId, userId: user.id, name }, 'Error creating service plan');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to create service plan' } },
        { status: 500 },
      );
    }

    const offeringIds = isALaCarte
      ? []
      : Array.isArray(body.offering_ids)
      ? (body.offering_ids as unknown[]).map((id) => String(id)).filter(Boolean)
      : [];

    if (offeringIds.length) {
      let offerings: Awaited<ReturnType<typeof loadOfferingsForPlanAssignment>> = [];
      try {
        offerings = await loadOfferingsForPlanAssignment(offeringIds);
      } catch (offeringsError) {
        logger.error(
          { error: offeringsError, orgId, userId: user.id, planId: data.id },
          'Error loading offerings for plan assignment',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to assign services to plan' } },
          { status: 500 },
        );
      }

      const foundIds = new Set((offerings || []).map((o) => String(o.id)));
      const missingIds = offeringIds.filter((id) => !foundIds.has(id));
      if (missingIds.length) {
        return NextResponse.json(
          {
            error: {
              code: 'BAD_REQUEST',
              message: `Invalid offering_ids: ${missingIds.join(', ')}`,
            },
          },
          { status: 400 },
        );
      }

      const rows = (offerings || []).map((o) => ({
        plan_id: data.id,
        offering_id: o.id,
        default_amount: 0,
        default_frequency: normalizeBillingFrequency(o.default_freq),
        default_included: true,
        billing_basis: o.billing_basis ?? null,
        rent_basis: o.default_rent_basis ?? null,
        markup_pct: o.markup_pct ?? null,
        markup_pct_cap: o.markup_pct_cap ?? null,
        hourly_rate: o.hourly_rate ?? null,
        hourly_min_hours: o.hourly_min_hours ?? null,
        is_required: false,
      })) as ServicePlanServiceInsert[];

      const { error: insertError } = await supabaseAdmin
        .from('service_plan_services')
        .upsert(rows, { onConflict: 'plan_id,offering_id' });

      if (insertError) {
        logger.error(
          { error: insertError, orgId, userId: user.id, planId: data.id },
          'Error assigning services to plan',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to assign services to plan' } },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/services/plans');
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const body = await request.json().catch(() => ({}));
    const planId = body?.id ? String(body.id) : null;
    const planName = body?.name ? String(body.name).trim() : null;

    if (!planId && !planName) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'id or name is required' } },
        { status: 400 },
      );
    }

    let targetId = planId;
    if (!targetId && planName) {
      const { data: lookup, error: lookupError } = await supabaseAdmin
        .from('service_plans')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', planName)
        .maybeSingle();
      if (lookupError) {
        logger.error({ lookupError, orgId, userId: user.id, planName }, 'Error finding plan');
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to find plan' } },
          { status: 500 },
        );
      }
      targetId = lookup?.id ? String(lookup.id) : null;
    }

    if (!targetId) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Plan not found' } },
        { status: 404 },
      );
    }

    const { error } = await supabaseAdmin
      .from('service_plans')
      .delete()
      .eq('org_id', orgId)
      .eq('id', targetId);

    if (error) {
      logger.error({ error, orgId, userId: user.id, planId: targetId }, 'Error deleting plan');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to delete plan' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in DELETE /api/services/plans');
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

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const body = await request.json().catch(() => ({}));
    const planId = body?.id ? String(body.id) : null;

    if (!planId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'id is required' } },
        { status: 400 },
      );
    }

    const { data: existingPlan, error: existingError } = await supabaseAdmin
      .from('service_plans')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('id', planId)
      .maybeSingle();
    if (existingError) {
      logger.error({ existingError, orgId, userId: user.id, planId }, 'Error loading plan for update');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load plan' } },
        { status: 500 },
      );
    }
    const existingName = existingPlan?.name ? String(existingPlan.name) : '';
    const nextName = body.name !== undefined ? String(body.name || '').trim() : existingName;
    const isALaCarte = isALaCartePlanName(nextName);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) {
      if (!nextName) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'name cannot be empty' } },
          { status: 400 },
        );
      }
      update.name = nextName;
    }
    if (isALaCarte) {
      update.amount_type = 'flat';
      update.percent_basis = null;
      update.gl_account_id = null;
      update.default_fee_amount = null;
      update.default_fee_percent = null;
    } else {
      if (body.amount_type !== undefined) update.amount_type = body.amount_type || 'flat';
      if (body.percent_basis !== undefined) update.percent_basis = body.percent_basis || null;
    }
    if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);
    if (!isALaCarte) {
      if (body.gl_account_id !== undefined) update.gl_account_id = body.gl_account_id ?? null;
      if (body.default_fee_amount !== undefined) {
        update.default_fee_amount =
          body.default_fee_amount === '' || body.default_fee_amount === null
            ? null
            : Number(body.default_fee_amount);
        if (update.default_fee_amount !== null && !Number.isFinite(update.default_fee_amount)) {
          return NextResponse.json(
            { error: { code: 'BAD_REQUEST', message: 'default_fee_amount must be a number' } },
            { status: 400 },
          );
        }
      }
      if (body.default_fee_percent !== undefined) {
        update.default_fee_percent =
          body.default_fee_percent === '' || body.default_fee_percent === null
            ? null
            : Number(body.default_fee_percent);
        if (update.default_fee_percent !== null && !Number.isFinite(update.default_fee_percent)) {
          return NextResponse.json(
            { error: { code: 'BAD_REQUEST', message: 'default_fee_percent must be a number' } },
            { status: 400 },
          );
        }
      }
    }

    if (!isALaCarte) {
      const nextAmountType = update.amount_type as string | undefined;
      if (nextAmountType === 'flat') {
        if (body.amount_type !== undefined) {
          if (update.default_fee_amount === null || update.default_fee_amount === undefined) {
            return NextResponse.json(
              {
                error: {
                  code: 'BAD_REQUEST',
                  message: 'default_fee_amount is required for flat plans',
                },
              },
              { status: 400 },
            );
          }
        }
        update.default_fee_percent = null;
        update.percent_basis = null;
      }
      if (nextAmountType === 'percent') {
        if (body.amount_type !== undefined) {
          if (update.default_fee_percent === null || update.default_fee_percent === undefined) {
            return NextResponse.json(
              {
                error: {
                  code: 'BAD_REQUEST',
                  message: 'default_fee_percent is required for percent plans',
                },
              },
              { status: 400 },
            );
          }
          if (!update.percent_basis) {
            return NextResponse.json(
              {
                error: { code: 'BAD_REQUEST', message: 'percent_basis is required for percent plans' },
              },
              { status: 400 },
            );
          }
        }
        update.default_fee_amount = null;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('service_plans')
      .update({
        ...update,
      })
      .eq('org_id', orgId)
      .eq('id', planId)
      .select(
        'id, name, amount_type, percent_basis, is_active, gl_account_id, default_fee_amount, default_fee_percent',
      )
      .single();

    if (error) {
      logger.error({ error, orgId, userId: user.id, planId }, 'Error updating service plan');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update service plan' } },
        { status: 500 },
      );
    }

    const offeringIds = isALaCarte
      ? []
      : Array.isArray(body.offering_ids)
        ? (body.offering_ids as unknown[]).map((id) => String(id)).filter(Boolean)
        : null;

    if (offeringIds) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('service_plan_services')
        .select('offering_id')
        .eq('plan_id', planId);

      if (existingError) {
        logger.error(
          { error: existingError, orgId, userId: user.id, planId },
          'Error fetching existing plan services',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to update plan services' } },
          { status: 500 },
        );
      }

      const existingIds = new Set((existing || []).map((r) => String(r.offering_id)));
      const desiredIds = new Set(offeringIds);
      const toDelete = Array.from(existingIds).filter((id) => !desiredIds.has(id));
      const toAdd = Array.from(desiredIds).filter((id) => !existingIds.has(id));

      if (toDelete.length) {
        const { error: deleteError } = await supabaseAdmin
          .from('service_plan_services')
          .delete()
          .eq('plan_id', planId)
          .in('offering_id', toDelete);

        if (deleteError) {
          logger.error(
            { error: deleteError, orgId, userId: user.id, planId },
            'Error removing plan services',
          );
          return NextResponse.json(
            { error: { code: 'QUERY_ERROR', message: 'Failed to update plan services' } },
            { status: 500 },
          );
        }
      }

      if (toAdd.length) {
        let offerings: Awaited<ReturnType<typeof loadOfferingsForPlanAssignment>> = [];
        try {
          offerings = await loadOfferingsForPlanAssignment(toAdd);
        } catch (offeringsError) {
          logger.error(
            { error: offeringsError, orgId, userId: user.id, planId },
            'Error loading offerings for plan assignment',
          );
          return NextResponse.json(
            { error: { code: 'QUERY_ERROR', message: 'Failed to update plan services' } },
            { status: 500 },
          );
        }

        const foundIds = new Set((offerings || []).map((o) => String(o.id)));
        const missingIds = toAdd.filter((id) => !foundIds.has(id));
        if (missingIds.length) {
          return NextResponse.json(
            {
              error: {
                code: 'BAD_REQUEST',
                message: `Invalid offering_ids: ${missingIds.join(', ')}`,
              },
            },
            { status: 400 },
          );
        }

        const rows = (offerings || []).map((o) => ({
          plan_id: planId,
          offering_id: o.id,
          default_amount: 0,
          default_frequency: o.default_freq || 'monthly',
          default_included: true,
          billing_basis: o.billing_basis ?? null,
          rent_basis: o.default_rent_basis ?? null,
          markup_pct: o.markup_pct ?? null,
          markup_pct_cap: o.markup_pct_cap ?? null,
          hourly_rate: o.hourly_rate ?? null,
          hourly_min_hours: o.hourly_min_hours ?? null,
          is_required: false,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('service_plan_services')
          .upsert(rows, { onConflict: 'plan_id,offering_id' });

        if (insertError) {
          logger.error(
            { error: insertError, orgId, userId: user.id, planId },
            'Error adding plan services',
          );
          return NextResponse.json(
            { error: { code: 'QUERY_ERROR', message: 'Failed to update plan services' } },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in PATCH /api/services/plans');
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
