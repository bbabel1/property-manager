import { NextResponse } from 'next/server'
import { requireRole, requireOrg } from '@/lib/auth/guards'

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { supabase } = await requireRole(['org_staff','org_manager','org_admin','platform_admin'])
    const { orgId } = await params
    await requireOrg(orgId)

    const now = Date.now()
    const ninetyDaysFromNowIso = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString()
    const url = new URL(req.url)
    const hours = Number.isFinite(Number(url.searchParams.get('hours')))
      ? Number(url.searchParams.get('hours'))
      : 24
    const windowHours = hours > 0 ? hours : 24
    const sinceIso = new Date(now - windowHours * 60 * 60 * 1000).toISOString()

    const [kpis, renewals, onboardingSummary, recentTx, activeWOs, expiringLeases] = await Promise.all([
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
      supabase
        .from('lease')
        .select('id,lease_to_date,renewal_offer_status,status')
        .eq('org_id', orgId)
        .in('status', ['active', 'Active', 'ACTIVE'])
        .not('lease_to_date', 'is', null)
        .gte('lease_to_date', new Date(now).toISOString())
        .lte('lease_to_date', ninetyDaysFromNowIso),
    ])

    const error =
      kpis.error ||
      renewals.error ||
      onboardingSummary.error ||
      recentTx.error ||
      activeWOs.error ||
      expiringLeases.error
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

    const bucketDefs = [
      { key: '0_30', label: '0 - 30 days', min: 0, max: 30 },
      { key: '31_60', label: '31 - 60 days', min: 31, max: 60 },
      { key: '61_90', label: '61 - 90 days', min: 61, max: 90 },
      { key: 'all', label: 'All (0-90 days)', min: 0, max: 90 },
    ] as const

    const makeCounts = () => ({ notStarted: 0, offers: 0, renewals: 0, moveOuts: 0, total: 0 })
    const expiringBuckets: Record<
      (typeof bucketDefs)[number]['key'],
      { key: string; label: string; counts: { notStarted: number; offers: number; renewals: number; moveOuts: number; total: number } }
    > = bucketDefs.reduce(
      (acc, def) => ({
        ...acc,
        [def.key]: { key: def.key, label: def.label, counts: makeCounts() },
      }),
      {} as Record<
        (typeof bucketDefs)[number]['key'],
        { key: string; label: string; counts: { notStarted: number; offers: number; renewals: number; moveOuts: number; total: number } }
      >
    )

    const normalizeStage = (status: string | null | undefined) => {
      const normalized = (status || '').toLowerCase()
      if (normalized === 'offered') return 'offers' as const
      if (normalized === 'accepted' || normalized === 'renewed') return 'renewals' as const
      if (normalized === 'declined' || normalized === 'expired') return 'moveOuts' as const
      return 'notStarted' as const
    }

    const nowDate = new Date(now)
    ;(expiringLeases.data ?? []).forEach((lease: any) => {
      const leaseTo = lease?.lease_to_date ? new Date(lease.lease_to_date) : null
      if (!leaseTo || Number.isNaN(leaseTo.getTime())) return
      const daysUntil = Math.floor((leaseTo.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil < 0) return

      const stage = normalizeStage(lease?.renewal_offer_status)
      bucketDefs.forEach((bucket) => {
        if (daysUntil >= bucket.min && daysUntil <= bucket.max) {
          const target = expiringBuckets[bucket.key]
          target.counts[stage] += 1
          target.counts.total += 1
        }
      })
    })

    return new NextResponse(
      JSON.stringify({
        kpis: kpis.data ?? null,
        renewals: renewalsData,
        onboarding: onboardingData,
        transactions: transactionsData,
        workOrders: workOrdersData,
        expiringLeases: {
          buckets: bucketDefs.map((bucket) => expiringBuckets[bucket.key]),
        },
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
