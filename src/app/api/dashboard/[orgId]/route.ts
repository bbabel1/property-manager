import { NextResponse } from 'next/server'
import { requireRole, requireOrg } from '@/lib/auth/guards'

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const { supabase } = await requireRole(['org_staff','org_manager','org_admin','platform_admin'])
    const orgId = params.orgId
    await requireOrg(orgId)

    const [kpis, renewals, onboardingSummary, recentTx, activeWOs] = await Promise.all([
      supabase
        .from('v_dashboard_kpis')
        .select(
          'org_id,total_properties,total_units,occupied_units,available_units,occupancy_rate_pct,monthly_rent_roll,active_leases,growth_rate_pct,open_work_orders,urgent_work_orders'
        )
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('v_lease_renewals_summary')
        .select('critical_30,upcoming_60,future_90')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('v_property_onboarding_summary')
        .select('in_progress,pending_approval,overdue')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('v_recent_transactions_ranked')
        .select('id,date,amount,memo,property_name,rn')
        .eq('org_id', orgId)
        .lte('rn', 5)
        .order('rn', { ascending: true }),
      supabase
        .from('v_active_work_orders_ranked')
        .select('id,title,description,priority,status,created_at,property_name,rn')
        .eq('org_id', orgId)
        .lte('rn', 5)
        .order('rn', { ascending: true }),
    ])

    const error = kpis.error || renewals.error || onboardingSummary.error || recentTx.error || activeWOs.error
    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load dashboard' }, { status: 500 })
    }

    return new NextResponse(
      JSON.stringify({
        kpis: kpis.data ?? null,
        renewals: renewals.data ?? null,
        onboarding: onboardingSummary.data ?? null,
        transactions: recentTx.data ?? [],
        workOrders: activeWOs.data ?? [],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=10',
        },
      }
    )
  } catch (e: any) {
    const msg: string = e?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : msg === 'ORG_FORBIDDEN' ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

