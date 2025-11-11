import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';

const isDevBypass = process.env.NODE_ENV === 'development';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    if (!isDevBypass) {
      const auth = await requireAuth();
      if (!hasPermission(auth.roles, 'monthly_logs.read')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 },
        );
      }
    }

    // Parse parameters
    const { logId } = await params;

    // Fetch monthly log with related data
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        period_start,
        stage,
        status,
        notes,
        pdf_url,
        created_at,
        updated_at,
        properties:property_id (
          id,
          name,
          address_line_1,
          address_line_2,
          city,
          state,
          postal_code
        ),
        units:unit_id (
          id,
          unit_number,
          unit_name,
          service_plan,
          active_services,
          fee_dollar_amount,
          billing_frequency
        ),
        tenants:tenant_id (
          id,
          contacts:contact_id (
            display_name,
            first_name,
            last_name,
            company_name,
            email,
            phone
          )
        ),
        activeLease:lease_id (
          id,
          lease_from_date,
          lease_to_date,
          rent_amount,
          tenant_names,
          total_charges
        )
      `,
      )
      .eq('id', logId)
      .single();

    if (logError || !monthlyLog) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Monthly log not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json(monthlyLog);
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]:', error);

    if (!isDevBypass && error instanceof Error && error.message === 'UNAUTHENTICATED') {
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
