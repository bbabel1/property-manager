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
import { format } from 'date-fns';

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
      .select('service_assignment, service_plan, fee_type, fee_percentage, fee_dollar_amount')
      .eq('id', monthlyLog.property_id)
      .single();

    if (propertyError) {
      console.error('Error fetching property:', propertyError);
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch property data' } },
        { status: 500 },
      );
    }

    // Determine data source based on service_assignment
    const serviceAssignment = property?.service_assignment;
    const usePropertyLevel = serviceAssignment === 'Property Level' || serviceAssignment === null;

    let feeDollarAmount: number | null = null;
    let servicePlan: string | null = null;

    if (usePropertyLevel) {
      // Use property-level data
      feeDollarAmount = property?.fee_dollar_amount || null;
      servicePlan = property?.service_plan || null;
    } else {
      // Use unit-level data
      const { data: unit, error: unitError } = await supabaseAdmin
        .from('units')
        .select('fee_dollar_amount, service_plan')
        .eq('id', monthlyLog.unit_id)
        .single();

      if (unitError) {
        console.error('Error fetching unit:', unitError);
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to fetch unit data' } },
          { status: 500 },
        );
      }

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

    // Create management fee transaction
    const feeDate = format(new Date(monthlyLog.period_start), 'yyyy-MM-dd');
    const memo = `Management Fee - ${servicePlan || 'Standard'} Plan`;

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        monthly_log_id: logId,
        transaction_type: 'Charge',
        total_amount: feeDollarAmount,
        date: feeDate,
        memo,
      })
      .select('id')
      .single();

    if (transactionError) {
      console.error('Error creating management fee transaction:', transactionError);
      return NextResponse.json(
        {
          error: {
            code: 'CREATION_FAILED',
            message: 'Failed to create management fee transaction',
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, transactionId: transaction.id });
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
