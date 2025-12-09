import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrg } from '@/lib/auth/guards';
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
    if (!hasPermission(auth.roles, 'dashboard.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { orgId } = await params;
    const { supabase } = await requireOrg(orgId);
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as 'month' | 'quarter' | 'year';
    const type = searchParams.get('type') || 'all';
    const propertyId = searchParams.get('propertyId');

    const { start, end } = getPeriodDates(period);

    const response: Record<string, unknown> = { data: {} };

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

      const aggregated = (data || []).reduce((acc: any, row: any) => {
        const key = row.offering_id;
        if (!acc[key]) {
          acc[key] = {
            offering_id: key,
            offering_name: row.offering_name || row.offering_id,
            category: row.category || '',
            revenue_amount: 0,
            cost_amount: 0,
            margin_amount: 0,
            margin_percentage: 0,
          };
        }
        acc[key].revenue_amount += Number(row.revenue_amount || 0);
        acc[key].cost_amount += Number(row.cost_amount || 0);
        acc[key].margin_amount += Number(row.margin_amount || 0);
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

      Object.values(aggregated).forEach((item: any) => {
        item.margin_percentage =
          item.revenue_amount > 0 ? (item.margin_amount / item.revenue_amount) * 100 : 0;
      });

      (response.data as any).profitability = Object.values(aggregated);
    }

    if (type === 'all' || type === 'revenue') {
      const revenueQuery = propertyId
        ? supabase.from('v_service_revenue_by_property').select('*').eq('property_id', propertyId)
        : supabase.from('v_service_revenue_by_offering').select('*');

      revenueQuery
        .eq('org_id', orgId)
        .gte('period_start', start)
        .lte('period_end', end)
        .order('period_start', { ascending: false })
        .limit(200);

      const { data, error } = await revenueQuery;

      if (error) {
        logger.error({ error }, 'Error fetching revenue');
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to load revenue data' } },
          { status: 500 },
        );
      }

      (response.data as any).revenue = data || [];
    }

    if (type === 'all' || type === 'utilization') {
      const nowIso = new Date().toISOString();
      const utilizationQuery = supabase
        .from('property_service_pricing')
        .select(
          `
          offering_id,
          property_id,
          unit_id,
          is_active,
          effective_start,
          effective_end,
          service_offerings!inner(id, name, category),
          properties!inner(org_id)
        `,
        )
        .eq('properties.org_id', orgId)
        .eq('is_active', true)
        .lte('effective_start', nowIso)
        .or(`effective_end.is.null,effective_end.gt.${nowIso}`)
        .limit(1000);

      if (propertyId) {
        utilizationQuery.eq('property_id', propertyId);
      }

      const { data, error } = await utilizationQuery;

      if (error) {
        logger.error({ error }, 'Error fetching utilization');
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to load utilization data' } },
          { status: 500 },
        );
      }

      const utilizationMap = new Map<
        string,
        {
          offering_id: string;
          offering_name: string;
          category: string;
          propertyIds: Set<string>;
          unitIds: Set<string>;
        }
      >();

      (data || []).forEach((row: any) => {
        const offering = row.service_offerings;
        if (!offering) return;
        const key = offering.id;
        if (!utilizationMap.has(key)) {
          utilizationMap.set(key, {
            offering_id: key,
            offering_name: offering.name,
            category: offering.category,
            propertyIds: new Set<string>(),
            unitIds: new Set<string>(),
          });
        }
        const item = utilizationMap.get(key)!;
        if (row.property_id) {
          item.propertyIds.add(row.property_id);
        }
        if (row.unit_id) {
          item.unitIds.add(row.unit_id);
        }
      });

      const utilization = Array.from(utilizationMap.values()).map((item) => {
        const totalProperties = item.propertyIds.size;
        const totalUnits = item.unitIds.size;
        return {
          offering_id: item.offering_id,
          offering_name: item.offering_name,
          category: item.category,
          total_properties: totalProperties,
          active_properties: totalProperties,
          total_units: totalUnits,
          active_units: totalUnits,
          utilization_rate: totalProperties > 0 ? (totalProperties / totalProperties) * 100 : 0,
        };
      });

      (response.data as any).utilization = utilization;
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
