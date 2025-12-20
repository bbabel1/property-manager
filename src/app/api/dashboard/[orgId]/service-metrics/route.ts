import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { userHasOrgAccess } from '@/lib/auth/org-access';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

function getPeriodDates(period: 'month' | 'quarter' | 'year') {
  const now = new Date();
  let start: Date;

  switch (period) {
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return {
    start: start.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    if (!hasPermission(roles, 'dashboard.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json(
        { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
        { status: 400 },
      );
    }

    const orgAllowed = await userHasOrgAccess({ supabase, user, orgId });
    if (!orgAllowed) {
      return NextResponse.json(
        { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as 'month' | 'quarter' | 'year';
    const type = searchParams.get('type') || 'all';
    const propertyId = searchParams.get('propertyId');

    const { start, end } = getPeriodDates(period);

    type ProfitabilityRow = {
      offering_id: string;
      offering_name: string;
      category: string;
      revenue_amount: number;
      cost_amount: number;
      margin_amount: number;
      margin_percentage: number;
    };

    type MetricsData = {
      profitability?: ProfitabilityRow[];
      revenue?: unknown[];
      utilization?: unknown[];
    };
    const response: { data: MetricsData } = { data: {} };

    if (type === 'all' || type === 'profitability') {
      const profitabilityQuery = supabase
        .from('v_service_profitability')
        .select('*')
        .eq('org_id', orgId)
        .gte('period_start', start)
        .lte('period_end', end)
        .order('period_start', { ascending: false })
        .limit(200);

      if (propertyId) {
        profitabilityQuery.eq('property_id', propertyId);
      }

      const { data, error } = await profitabilityQuery;

      if (error) {
        logger.error({ error }, 'Error fetching profitability');
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to load profitability data' } },
          { status: 500 },
        );
      }

      const aggregated = (data || []).reduce<Record<string, ProfitabilityRow>>((acc, row) => {
        const key = String((row as { offering_id?: string }).offering_id || '');
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = {
            offering_id: key,
            offering_name:
              (row as { offering_name?: string }).offering_name ||
              (row as { offering_id?: string }).offering_id ||
              key,
            category: (row as { category?: string }).category || '',
            revenue_amount: 0,
            cost_amount: 0,
            margin_amount: 0,
            margin_percentage: 0,
          };
        }
        acc[key].revenue_amount += Number((row as { revenue_amount?: number }).revenue_amount || 0);
        acc[key].cost_amount += Number((row as { cost_amount?: number }).cost_amount || 0);
        acc[key].margin_amount += Number((row as { margin_amount?: number }).margin_amount || 0);
        return acc;
      }, {});

      const offeringIds = Object.keys(aggregated);
      if (offeringIds.length) {
        const { data: offeringMeta } = await supabase
          .from('service_offerings')
          .select('id, name, category')
          .in('id', offeringIds);

        (offeringMeta || []).forEach((offering) => {
          const entry = aggregated[offering.id];
          if (entry) {
            entry.offering_name = offering.name || entry.offering_name;
            entry.category = offering.category || entry.category;
          }
        });
      }

      Object.values(aggregated).forEach((item) => {
        item.margin_percentage =
          item.revenue_amount > 0 ? (item.margin_amount / item.revenue_amount) * 100 : 0;
      });

      response.data.profitability = Object.values(aggregated);
    }

    if (type === 'all' || type === 'revenue') {
      const revenueQuery = propertyId
        ? supabase.from('v_service_revenue_by_property').select('*')
        : supabase.from('v_service_revenue_by_offering').select('*');

      revenueQuery
        .eq('org_id', orgId)
        .gte('period_start', start)
        .lte('period_end', end)
        .order('period_start', { ascending: false })
        .limit(200);

      if (propertyId) {
        revenueQuery.eq('property_id', propertyId);
      }

      const { data, error } = await revenueQuery;

      if (error) {
        logger.error({ error }, 'Error fetching revenue');
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to load revenue data' } },
          { status: 500 },
        );
      }

      response.data.revenue = data || [];
    }

    if (type === 'all' || type === 'utilization') {
      // Per-service utilization is no longer tracked; return an empty set.
      response.data.utilization = [];
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/dashboard/[orgId]/service-metrics');
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
