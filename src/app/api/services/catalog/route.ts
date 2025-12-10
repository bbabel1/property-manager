import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/db';

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    const canReadCatalog =
      hasPermission(roles, 'settings.read') ||
      hasPermission(roles, 'settings.write') ||
      hasPermission(roles, 'properties.read');

    if (!canReadCatalog) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);

    const { data: offerings, error } = await supabase
      .from('service_offerings')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      logger.error({ error, orgId, userId: user.id }, 'Error fetching service offerings');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch service offerings' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: offerings || [] });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/catalog');
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
    const requiredFields = [
      'code',
      'name',
      'category',
      'billing_basis',
      'default_freq',
      'applies_to',
      'bill_on',
    ];
    const missing = requiredFields.filter((field) => {
      const value = body[field];
      return value === undefined || value === null || (typeof value === 'string' && !value.trim());
    });

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: `Missing required fields: ${missing.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    const billingBasis = body.billing_basis;
    const defaultRate = parseNumber(body.default_rate);
    const markupPct = parseNumber(body.markup_pct);
    const hourlyRate = parseNumber(body.hourly_rate);
    const hourlyMinHours = parseNumber(body.hourly_min_hours);

    if (billingBasis === 'percent_rent' && defaultRate === null) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'default_rate is required when billing_basis is percent_rent',
          },
        },
        { status: 400 },
      );
    }

    if (billingBasis === 'job_cost' && markupPct === null) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'markup_pct is required when billing_basis is job_cost',
          },
        },
        { status: 400 },
      );
    }

    if (billingBasis === 'hourly' && (hourlyRate === null || hourlyMinHours === null)) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'hourly_rate and hourly_min_hours are required when billing_basis is hourly',
          },
        },
        { status: 400 },
      );
    }

    const payload: Record<string, any> = {
      code: String(body.code).trim(),
      name: String(body.name).trim(),
      category: body.category,
      description: body.description ? String(body.description).trim() : null,
      billing_basis: billingBasis,
      default_rate: defaultRate,
      default_freq: body.default_freq,
      min_amount: parseNumber(body.min_amount),
      max_amount: parseNumber(body.max_amount),
      applies_to: body.applies_to,
      bill_on: body.bill_on,
      markup_pct: billingBasis === 'job_cost' ? markupPct : null,
      markup_pct_cap: billingBasis === 'job_cost' ? parseNumber(body.markup_pct_cap) : null,
      hourly_rate: billingBasis === 'hourly' ? hourlyRate : null,
      hourly_min_hours: billingBasis === 'hourly' ? hourlyMinHours : null,
      default_rent_basis: billingBasis === 'percent_rent' ? body.default_rent_basis || 'scheduled' : null,
      is_active: body.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('service_offerings')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      const code = (error as any)?.code;
      if (code === '23505') {
        return NextResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'A service offering with this code already exists',
            },
          },
          { status: 409 },
        );
      }

      logger.error({ error, userId: user.id }, 'Error creating service offering');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to create service offering' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/services/catalog');
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
