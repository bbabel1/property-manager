import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    const canReadPlanOfferings =
      hasPermission(roles, 'settings.read') ||
      hasPermission(roles, 'settings.write') ||
      hasPermission(roles, 'properties.read');

    if (!canReadPlanOfferings) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const planFilter = searchParams.get('plan');

    // service_plan_offerings doesn't have org_id, it's a global catalog mapping
    let query = supabase
      .from('service_plan_offerings')
      .select(
        `
        service_plan,
        offering_id,
        is_included,
        is_optional,
        service_offerings!inner(id, name, code, category)
      `,
      );

    if (planFilter) {
      query = query.eq('service_plan', planFilter);
    }

    const { data: offerings, error } = await query
      .order('service_plan')
      .order('service_offerings(name)');

    if (error) {
      logger.error({ error, userId: user.id }, 'Error fetching plan offerings');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch plan offerings' } },
        { status: 500 },
      );
    }

    const transformed = (offerings || []).map((o: any) => ({
      service_plan: o.service_plan,
      offering_id: o.offering_id,
      is_included: o.is_included,
      is_optional: o.is_optional,
      offering_name: o.service_offerings?.name || 'Unknown',
      offering_code: o.service_offerings?.code || '',
      offering_category: o.service_offerings?.category || '',
    }));

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/plan-offerings');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}





