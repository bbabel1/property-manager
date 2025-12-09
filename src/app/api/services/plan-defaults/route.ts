import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'settings.read') && !hasPermission(auth.roles, 'properties.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: defaults, error } = await supabaseAdmin
      .from('service_plan_default_pricing')
      .select(
        `
        service_plan,
        offering_id,
        billing_basis,
        default_rate,
        plan_fee_percent,
        min_monthly_fee,
        service_offerings!inner(name)
      `,
      )
      .order('service_plan')
      .order('service_offerings(name)');

    if (error) {
      console.error('Error fetching plan defaults:', error);
      return NextResponse.json(
        { error: 'Failed to fetch plan defaults', details: error.message },
        { status: 500 },
      );
    }

    // Transform the data to flatten the nested service_offerings
    const transformed = (defaults || []).map((d: any) => ({
      service_plan: d.service_plan,
      offering_id: d.offering_id,
      offering_name: d.service_offerings?.name || 'Unknown',
      billing_basis: d.billing_basis,
      default_rate: d.default_rate,
      plan_fee_percent: d.plan_fee_percent,
      min_monthly_fee: d.min_monthly_fee,
    }));

    return NextResponse.json({ data: transformed });
  } catch (err) {
    console.error('Error in GET /api/services/plan-defaults:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
