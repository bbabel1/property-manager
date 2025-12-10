import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/db';

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    const billingBasis = body.billing_basis;
    const updateData: Record<string, any> = {};

    const set = (key: string, value: any) => {
      if (value !== undefined) updateData[key] = value;
    };

    set('code', typeof body.code === 'string' ? body.code.trim() : undefined);
    set('name', typeof body.name === 'string' ? body.name.trim() : undefined);
    set('category', body.category);
    set('description', typeof body.description === 'string' ? body.description.trim() : body.description);
    if (billingBasis !== undefined) set('billing_basis', billingBasis);
    set('default_rate', parseNumber(body.default_rate));
    set('default_freq', body.default_freq);
    set('min_amount', parseNumber(body.min_amount));
    set('max_amount', parseNumber(body.max_amount));
    set('applies_to', body.applies_to);
    set('bill_on', body.bill_on);

    if (billingBasis === 'job_cost') {
      set('markup_pct', parseNumber(body.markup_pct));
      set('markup_pct_cap', parseNumber(body.markup_pct_cap));
    } else if (billingBasis !== undefined) {
      set('markup_pct', null);
      set('markup_pct_cap', null);
    } else if (body.markup_pct !== undefined || body.markup_pct_cap !== undefined) {
      set('markup_pct', parseNumber(body.markup_pct));
      set('markup_pct_cap', parseNumber(body.markup_pct_cap));
    }

    if (billingBasis === 'hourly') {
      set('hourly_rate', parseNumber(body.hourly_rate));
      set('hourly_min_hours', parseNumber(body.hourly_min_hours));
    } else if (billingBasis !== undefined) {
      set('hourly_rate', null);
      set('hourly_min_hours', null);
    } else if (body.hourly_rate !== undefined || body.hourly_min_hours !== undefined) {
      set('hourly_rate', parseNumber(body.hourly_rate));
      set('hourly_min_hours', parseNumber(body.hourly_min_hours));
    }

    if (billingBasis === 'percent_rent') {
      set('default_rent_basis', body.default_rent_basis || 'scheduled');
    } else if (billingBasis !== undefined) {
      set('default_rent_basis', null);
    } else if (body.default_rent_basis !== undefined) {
      set('default_rent_basis', body.default_rent_basis);
    }

    set('is_active', typeof body.is_active === 'boolean' ? body.is_active : undefined);
    set('updated_at', new Date().toISOString());

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'No fields to update' } },
        { status: 400 },
      );
    }

    const { data: exists, error: existsError } = await supabaseAdmin
      .from('service_offerings')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (existsError) {
      logger.error({ error: existsError, userId: user.id }, 'Error verifying service offering');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to verify service offering' } },
        { status: 500 },
      );
    }

    if (!exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Service offering not found' } },
        { status: 404 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('service_offerings')
      .update(updateData)
      .eq('id', id)
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
      logger.error({ error, userId: user.id }, 'Error updating service offering');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update service offering' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in PUT /api/services/catalog/[id]');
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
