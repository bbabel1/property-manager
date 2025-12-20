/**
 * Management Fees Stage Data API
 *
 * Returns management fee configuration and assigned fee transactions.
 * Uses service plan assignments (service_plan_assignments) as the source of truth.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Fetch monthly log to get unit and property
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('unit_id, property_id, period_start, org_id')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Fetch property with service_assignment to determine which assignment level should apply.
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('service_assignment')
      .eq('id', monthlyLog.property_id)
      .single();

    if (propertyError) {
      console.error('Error fetching property:', propertyError);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch property data' } },
        { status: 500 },
      );
    }

    const orgId = monthlyLog.org_id;
    const unitId = monthlyLog.unit_id ?? null;
    const propertyId = monthlyLog.property_id;
    const serviceAssignment = property?.service_assignment ?? null;

    const wantsUnitLevel = serviceAssignment === 'Unit Level';

    const loadAssignment = async (scope: 'unit' | 'property') => {
      const query = supabaseAdmin
        .from('service_plan_assignments')
        .select('id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency')
        .eq('org_id', orgId)
        .is('effective_end', null)
        .order('effective_start', { ascending: false })
        .limit(1);

      const scoped =
        scope === 'unit' && unitId
          ? query.eq('unit_id', unitId)
          : query.eq('property_id', propertyId).is('unit_id', null);

      const { data } = await scoped.maybeSingle();
      return data ?? null;
    };

    const unitAssignment = unitId ? await loadAssignment('unit') : null;
    const propertyAssignment = await loadAssignment('property');
    const assignment = wantsUnitLevel ? unitAssignment : propertyAssignment;
    const effectiveAssignment = assignment ?? unitAssignment ?? propertyAssignment;

    const assignmentId = effectiveAssignment?.id ?? null;
    const planId = effectiveAssignment?.plan_id ? String(effectiveAssignment.plan_id) : null;

    let servicePlan: string | null = null;
    if (planId) {
      const { data: planRow } = await supabaseAdmin
        .from('service_plans')
        .select('name')
        .eq('id', planId)
        .maybeSingle();
      servicePlan = planRow?.name ? String(planRow.name) : null;
    }

    const isALaCarte = (servicePlan || '').trim().toLowerCase() === 'a-la-carte';

    let activeServices: string[] = [];
    if (planId) {
      if (isALaCarte && assignmentId) {
        const { data: rows } = await supabaseAdmin
          .from('service_offering_assignments')
          .select('offering_id, is_active')
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: true });
        const offeringIds = (rows || [])
          .filter((r: any) => r?.is_active !== false)
          .map((r: any) => String(r.offering_id))
          .filter(Boolean);
        if (offeringIds.length) {
          const { data: offerings } = await supabaseAdmin
            .from('service_offerings')
            .select('id, name')
            .in('id', offeringIds);
          activeServices = (offerings || []).map((o: any) => String(o.name || '')).filter(Boolean);
        }
      } else {
        const { data: rows } = await supabaseAdmin
          .from('service_plan_services')
          .select('offering_id')
          .eq('plan_id', planId);
        const offeringIds = (rows || []).map((r: any) => String(r.offering_id)).filter(Boolean);
        if (offeringIds.length) {
          const { data: offerings } = await supabaseAdmin
            .from('service_offerings')
            .select('id, name')
            .in('id', offeringIds);
          activeServices = (offerings || []).map((o: any) => String(o.name || '')).filter(Boolean);
        }
      }
    }

    const amountFlat =
      effectiveAssignment?.plan_fee_amount != null ? Number(effectiveAssignment.plan_fee_amount) : 0;
    const percent =
      effectiveAssignment?.plan_fee_percent != null ? Number(effectiveAssignment.plan_fee_percent) : 0;
    const billingFrequency = effectiveAssignment?.plan_fee_frequency
      ? String(effectiveAssignment.plan_fee_frequency)
      : null;

    let rentAmount: number | null = null;
    if (unitId) {
      const { data: leaseRow } = await supabaseAdmin
        .from('lease')
        .select('rent_amount, lease_from_date')
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .order('lease_from_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      rentAmount = leaseRow?.rent_amount != null ? Number(leaseRow.rent_amount) : null;
    }

    const computedFromPercent =
      percent > 0 && rentAmount != null ? (percent * rentAmount) / 100 : 0;
    const feeDollarAmount = amountFlat > 0 ? amountFlat : computedFromPercent;
    const feeType = amountFlat > 0 ? 'Flat Rate' : percent > 0 ? 'Percentage' : null;
    const feePercentage = percent > 0 ? percent : null;

    // Fetch assigned management fee transactions
    const { data: assignedFees, error: feesError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('monthly_log_id', logId)
      .eq('transaction_type', 'Charge')
      .in('fee_category', ['plan_fee', 'legacy'])
      .or('memo.ilike.%management fee%,legacy_memo.ilike.%management fee%')
      .order('date', { ascending: false });

    if (feesError) {
      console.error('Error fetching management fees:', feesError);
    }

    // Calculate total fees
    const totalFees = (assignedFees || []).reduce(
      (sum, fee) => sum + Math.abs(fee.total_amount),
      0,
    );

    return NextResponse.json({
      servicePlan,
      activeServices,
      feeDollarAmount: feeDollarAmount ?? 0,
      feeType,
      feePercentage,
      billingFrequency,
      assignedFees: assignedFees || [],
      totalFees,
      serviceAssignment,
      periodStart: monthlyLog?.period_start ?? null,
      assignmentId,
      planId,
      rentAmount,
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/management-fees:', error);

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
