import { NextResponse } from 'next/server'
import { requireRole, requireOrg } from '@/lib/auth/guards'

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { supabase } = await requireRole(['org_staff','org_manager','org_admin','platform_admin'])
    const { orgId } = await params
    await requireOrg(orgId)

    const now = Date.now()
    const url = new URL(req.url)
    const hours = Number.isFinite(Number(url.searchParams.get('hours')))
      ? Number(url.searchParams.get('hours'))
      : 24
    const windowHours = hours > 0 ? hours : 24
    const sinceIso = new Date(now - windowHours * 60 * 60 * 1000).toISOString()

    const [kpis, renewals, onboardingSummary, recentTx, activeWOs] = await Promise.all([
      supabase
        .from('v_dashboard_kpis')
        .select(
          'org_id,total_properties,total_units,occupied_units,available_units,occupancy_rate,monthly_rent_roll,active_leases,growth_rate,open_work_orders,urgent_work_orders'
        )
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('v_lease_renewals_summary')
        .select('critical,upcoming,future')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('v_property_onboarding_summary')
        .select('in_progress,pending_approval,overdue')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('v_recent_transactions_ranked')
        .select('id,date,total_amount,memo,transaction_type,created_at')
        .eq('org_id', orgId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .order('date', { ascending: false })
        .range(0, 49),
      supabase
        .from('v_active_work_orders_ranked')
        .select('id,subject,description,priority,status,created_at,scheduled_date,rn')
        .eq('org_id', orgId)
        .lte('rn', 5)
        .order('rn', { ascending: true }),
    ])

    const error = kpis.error || renewals.error || onboardingSummary.error || recentTx.error || activeWOs.error
    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load dashboard' }, { status: 500 })
    }

    const renewalsData = renewals.data
      ? {
          critical_30: renewals.data.critical ?? 0,
          upcoming_60: renewals.data.upcoming ?? 0,
          future_90: renewals.data.future ?? 0,
        }
      : null

    const onboardingData = onboardingSummary.data
      ? {
          in_progress: onboardingSummary.data.in_progress ?? 0,
          pending_approval: onboardingSummary.data.pending_approval ?? 0,
          overdue: onboardingSummary.data.overdue ?? 0,
        }
      : null

    const transactionsData = (recentTx.data ?? []).map((t: any) => ({
      id: t.id,
      date: t.date,
      created_at: t.created_at,
      amount: t.total_amount ?? 0,
      memo: t.memo ?? null,
      property_name: null,
      type: t.transaction_type ?? null,
    }))

    const workOrdersData = (activeWOs.data ?? []).map((w: any) => ({
      id: w.id,
      title: w.subject ?? 'Work order',
      description: w.description ?? null,
      priority: w.priority ?? null,
      status: w.status ?? null,
      created_at: w.created_at,
      scheduled_date: w.scheduled_date ?? null,
      property_name: null,
    }))

    return new NextResponse(
      JSON.stringify({
        kpis: kpis.data ?? null,
        renewals: renewalsData,
        onboarding: onboardingData,
        transactions: transactionsData,
        workOrders: workOrdersData,
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
