/**
 * Management Fees Stage Data API
 *
 * Returns management fee configuration and assigned fee transactions.
 * Uses service_assignment field to determine whether to fetch data from properties or units table.
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
      .select('unit_id, property_id, period_start')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Fetch property with service_assignment to determine data source
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select(
        'service_assignment, service_plan, active_services, fee_assignment, fee_type, fee_percentage, fee_dollar_amount, billing_frequency',
      )
      .eq('id', monthlyLog.property_id)
      .single();

    if (propertyError) {
      console.error('Error fetching property:', propertyError);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch property data' } },
        { status: 500 },
      );
    }

    const { data: unit, error: unitError } = monthlyLog.unit_id
      ? await supabaseAdmin
          .from('units')
          .select(
            'service_plan, active_services, fee_type, fee_percent, fee_dollar_amount, fee_frequency',
          )
          .eq('id', monthlyLog.unit_id)
          .maybeSingle()
      : { data: null, error: null };

    if (unitError) {
      console.error('Error fetching unit:', unitError);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch unit data' } },
        { status: 500 },
      );
    }

    // Determine data source based on service_assignment
    const serviceAssignment = property?.service_assignment;
    const isServicePropertyLevel =
      serviceAssignment === 'Property Level' ||
      serviceAssignment === 'Building' ||
      serviceAssignment === null;

    const feeAssignment = property?.fee_assignment ?? null;
    const isFeePropertyLevel =
      feeAssignment === 'Property Level' || feeAssignment === 'Building' || feeAssignment === null;

    const parseActiveServices = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map((v) => String(v));
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.map((v) => String(v));
        } catch {
          // noop
        }
        return value
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    const servicePlan = isServicePropertyLevel
      ? property?.service_plan || null
      : unit?.service_plan || null;
    const activeServices = isServicePropertyLevel
      ? parseActiveServices(property?.active_services)
      : parseActiveServices(unit?.active_services);

    const feeType = isFeePropertyLevel ? property?.fee_type || null : unit?.fee_type || null;
    const feePercentage = isFeePropertyLevel
      ? property?.fee_percentage || null
      : unit?.fee_percent || null;
    const feeDollarAmount = isFeePropertyLevel
      ? property?.fee_dollar_amount ?? null
      : unit?.fee_dollar_amount ?? null;
    const billingFrequency = isFeePropertyLevel
      ? property?.billing_frequency || null
      : unit?.fee_frequency || null;

    // Fetch assigned management fee transactions
    const { data: assignedFees, error: feesError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('monthly_log_id', logId)
      .eq('transaction_type', 'Charge')
      .ilike('memo', '%management fee%')
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
      feeAssignment,
      sources: {
        service: isServicePropertyLevel ? 'property' : 'unit',
        fee: isFeePropertyLevel ? 'property' : 'unit',
      },
      propertyContext: {
        feeType: property?.fee_type ?? null,
        feePercentage: property?.fee_percentage ?? null,
        feeDollarAmount: property?.fee_dollar_amount ?? null,
        billingFrequency: property?.billing_frequency ?? null,
        servicePlan: property?.service_plan ?? null,
        activeServices: parseActiveServices(property?.active_services),
      },
      unitContext: {
        feeType: unit?.fee_type ?? null,
        feePercent: unit?.fee_percent ?? null,
        feeDollarAmount: unit?.fee_dollar_amount ?? null,
        billingFrequency: unit?.fee_frequency ?? null,
        servicePlan: unit?.service_plan ?? null,
        activeServices: parseActiveServices(unit?.active_services),
      },
      periodStart: monthlyLog?.period_start ?? null,
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
