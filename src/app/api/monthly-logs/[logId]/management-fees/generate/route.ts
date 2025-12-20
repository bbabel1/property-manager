
/**
 * Generate Management Fee Transaction API
 *
 * Auto-generates a management fee transaction based on service_assignment configuration.
 * Uses service_assignment field to determine whether to fetch fee data from properties or units table.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/db';
import { isNewServiceCatalogEnabled, writeServiceFeeDual } from '@/lib/service-compatibility';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Fetch monthly log to get unit and period
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select('unit_id, property_id, period_start, period_end, org_id')
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    // Check if new service catalog is enabled
    let useNewCatalog = isNewServiceCatalogEnabled();

    let feeAmount: number = 0;
    let servicePlanName: string | null = null;
    let feeCategory: 'plan_fee' | 'service_fee' | 'override' | 'legacy' = 'legacy';

    let lease: { rent_amount: number | null } | null = null;

    if (useNewCatalog) {
      // Use new service catalog calculation
      try {
        // Get active lease for rent calculation
        const { data: leaseRow } = await supabaseAdmin
          .from('lease')
          .select('rent_amount, lease_from_date, lease_to_date')
          .eq('unit_id', monthlyLog.unit_id)
          .eq('status', 'active')
          .order('lease_from_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        lease = leaseRow || null;

        // Get market rent for capping
        const { data: unit } = await supabaseAdmin
          .from('units')
          .select('market_rent')
          .eq('id', monthlyLog.unit_id)
          .maybeSingle();

        // Active assignment (unit-level first, then property-level)
        const { data: assignment } = await supabaseAdmin
          .from('service_plan_assignments')
          .select('id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency')
          .eq('org_id', monthlyLog.org_id)
          .eq('unit_id', monthlyLog.unit_id)
          .eq('is_active', true)
          .is('effective_end', null)
          .maybeSingle();

        const effectiveAssignment =
          assignment ||
          (await supabaseAdmin
            .from('service_plan_assignments')
            .select('id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency')
            .eq('org_id', monthlyLog.org_id)
            .eq('property_id', monthlyLog.property_id)
            .is('unit_id', null)
            .eq('is_active', true)
            .is('effective_end', null)
            .maybeSingle()).data;

        const planUuid = effectiveAssignment?.plan_id ? String(effectiveAssignment.plan_id) : null;
        if (planUuid) {
          const { data: planRow } = await supabaseAdmin
            .from('service_plans')
            .select('name')
            .eq('id', planUuid)
            .maybeSingle();
          servicePlanName = planRow?.name ? String(planRow.name) : null;
        }

        const rentAmount = lease?.rent_amount || 0;
        const percent = effectiveAssignment?.plan_fee_percent ?? 0;
        const amountFlat = effectiveAssignment?.plan_fee_amount ?? 0;
        feeAmount = amountFlat > 0 ? amountFlat : percent > 0 ? (percent * rentAmount) / 100 : 0;
        feeCategory = 'plan_fee';

        // If no fee calculated, fall back to legacy calculation
        if (feeAmount <= 0) {
          useNewCatalog = false; // Fall through to legacy logic
        }
      } catch (error) {
        logger.warn({ error }, 'Error calculating fee with new catalog, falling back to legacy');
        useNewCatalog = false;
      }
    }

    // Legacy calculation (fallback or when feature flag is off)
    if (!useNewCatalog || feeAmount <= 0) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_CONFIGURATION',
            message: 'No management fee configured for this unit',
          },
        },
        { status: 400 },
      );
    }

    // Create fee using dual-write (always creates billing_events when flag is on)
    const memo = `Management Fee - ${servicePlanName || 'Standard'} Plan`;

    const { transactionId, billingEventId } = await writeServiceFeeDual({
      monthlyLogId: logId,
      propertyId: monthlyLog.property_id,
      unitId: monthlyLog.unit_id,
      amount: feeAmount,
      // Legacy enum plan_id/offering_id columns are deprecated; store identifiers in memo + fee_category.
      planId: null,
      offeringId: null,
      feeCategory,
      legacyMemo: memo,
      sourceBasis: feeCategory === 'plan_fee' ? 'percent_rent' : undefined,
      rentBasis: 'scheduled',
      rentAmount:
        (servicePlanName || '').trim() === 'Basic' || (servicePlanName || '').trim() === 'Full'
          ? lease?.rent_amount || null
          : undefined,
    });

    return NextResponse.json({
      success: true,
      transactionId,
      billingEventId,
      amount: feeAmount,
    });
  } catch (error) {
    console.error('Error in POST /api/monthly-logs/[logId]/management-fees/generate:', error);

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
