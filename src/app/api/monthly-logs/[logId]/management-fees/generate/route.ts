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
import { calculateServiceFee } from '@/lib/service-pricing';
import { logger } from '@/lib/logger';

export async function POST(request: Request, { params }: { params: { logId: string } }) {
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
    const { logId } = params;

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

    // Fetch property with service_assignment to determine data source
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select(
        'service_assignment, service_plan, fee_type, fee_percentage, fee_dollar_amount, org_id',
      )
      .eq('id', monthlyLog.property_id)
      .single();

    if (propertyError) {
      logger.error({ error: propertyError }, 'Error fetching property');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch property data' } },
        { status: 500 },
      );
    }

    // Check if new service catalog is enabled
    let useNewCatalog = isNewServiceCatalogEnabled();

    let feeAmount: number = 0;
    let servicePlan: string | null = property?.service_plan || null;
    let offeringId: string | null = null;
    let feeCategory: 'plan_fee' | 'service_fee' | 'override' | 'legacy' = 'legacy';

    if (useNewCatalog) {
      // Use new service catalog calculation
      try {
        // Get active lease for rent calculation
        const { data: lease } = await supabaseAdmin
          .from('lease')
          .select('rent_amount, lease_from_date, lease_to_date')
          .eq('unit_id', monthlyLog.unit_id)
          .eq('status', 'active')
          .order('lease_from_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get market rent for capping
        const { data: unit } = await supabaseAdmin
          .from('units')
          .select('market_rent, service_plan')
          .eq('id', monthlyLog.unit_id)
          .maybeSingle();

        if (unit?.service_plan) {
          servicePlan = unit.service_plan;
        }

        // For Basic/Full plans, calculate percentage of rent
        if (servicePlan === 'Basic' || servicePlan === 'Full') {
          // Get plan fee percent from defaults
          const { data: planDefault } = await supabaseAdmin
            .from('service_plan_default_pricing')
            .select('plan_fee_percent, min_monthly_fee, offering_id')
            .eq('service_plan', servicePlan)
            .eq('billing_basis', 'percent_rent')
            .limit(1)
            .maybeSingle();

          if (planDefault) {
            offeringId = planDefault.offering_id;
            const rentAmount = lease?.rent_amount || 0;
            const percentage = planDefault.plan_fee_percent || 0;
            feeAmount = (rentAmount * percentage) / 100;

            // Apply min_monthly_fee if specified
            if (
              planDefault.min_monthly_fee &&
              planDefault.min_monthly_fee > 0 &&
              feeAmount < planDefault.min_monthly_fee
            ) {
              feeAmount = planDefault.min_monthly_fee;
            }

            feeCategory = 'plan_fee';
          }
        } else if (servicePlan === 'A-la-carte' || servicePlan === 'Custom') {
          // Sum individual service fees
          const { data: pricingConfigs } = await supabaseAdmin
            .from('property_service_pricing')
            .select('offering_id, billing_basis, rate, billing_frequency, min_monthly_fee')
            .eq('property_id', monthlyLog.property_id)
            .eq('unit_id', monthlyLog.unit_id || null)
            .eq('is_active', true)
            .is('effective_end', null);

          if (pricingConfigs && pricingConfigs.length > 0) {
            for (const pricing of pricingConfigs) {
              const result = await calculateServiceFee({
                propertyId: monthlyLog.property_id,
                unitId: monthlyLog.unit_id,
                offeringId: pricing.offering_id,
                servicePlan,
                periodStart: monthlyLog.period_start,
                periodEnd: monthlyLog.period_end,
                leaseRentAmount: lease?.rent_amount || null,
                marketRent: unit?.market_rent || null,
              });
              feeAmount += result.amount;
            }
            feeCategory = 'service_fee';
          }
        }

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
      const serviceAssignment = property?.service_assignment;
      const usePropertyLevel = serviceAssignment === 'Property Level' || serviceAssignment === null;

      let feeDollarAmount: number | null = null;

      if (usePropertyLevel) {
        feeDollarAmount = property?.fee_dollar_amount || null;
        servicePlan = property?.service_plan || null;
      } else {
        const { data: unit } = await supabaseAdmin
          .from('units')
          .select('fee_dollar_amount, service_plan')
          .eq('id', monthlyLog.unit_id)
          .single();

        feeDollarAmount = unit?.fee_dollar_amount || null;
        servicePlan = unit?.service_plan || null;
      }

      if (!feeDollarAmount || feeDollarAmount <= 0) {
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

      feeAmount = feeDollarAmount;
      feeCategory = 'legacy';
    }

    // Create fee using dual-write (always creates billing_events when flag is on)
    const memo = `Management Fee - ${servicePlan || 'Standard'} Plan`;

    const { transactionId, billingEventId } = await writeServiceFeeDual({
      monthlyLogId: logId,
      propertyId: monthlyLog.property_id,
      unitId: monthlyLog.unit_id,
      amount: feeAmount,
      planId: servicePlan,
      offeringId: offeringId || null,
      feeCategory,
      legacyMemo: memo,
      sourceBasis: feeCategory === 'plan_fee' ? 'percent_rent' : undefined,
      rentBasis: 'scheduled',
      rentAmount:
        servicePlan === 'Basic' || servicePlan === 'Full'
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
