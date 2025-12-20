import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveResourceOrg, requireOrgMember } from '@/lib/auth/org-guards';

const isDevBypass = process.env.NODE_ENV === 'development';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    const auth = await requireAuth();
    // Use the service-role client to resolve org without being blocked by RLS
    // (membership is enforced below via requireOrgMember)
    const resolvedOrg = await resolveResourceOrg(supabaseAdmin, 'monthly_log', (await params).logId);
    if (!resolvedOrg.ok) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: resolvedOrg.error } },
        { status: 404 },
      );
    }
    await requireOrgMember({ client: auth.supabase, userId: auth.user.id, orgId: resolvedOrg.orgId });
    if (!hasPermission(auth.roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
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
          property_id,
          unit_id,
          tenant_id,
          org_id,
          properties:properties (
            id,
            name,
            address_line1,
            address_line2,
            address_line3,
            city,
            state,
            postal_code
          ),
          units:units (
            id,
            unit_number,
            unit_name
          ),
          tenants:tenants (
            id,
            contact:contacts (
              display_name,
              first_name,
              last_name,
              company_name
            )
          )
        `,
      )
      .eq('id', logId)
      .eq('org_id', resolvedOrg.orgId)
      .maybeSingle();

    if (logError) {
      console.error('[api][monthly-logs] Failed to fetch monthly log', { logId, error: logError });
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch monthly log' } },
        { status: 500 },
      );
    }

    if (!monthlyLog) {
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
