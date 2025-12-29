import { NextResponse } from 'next/server';
import type { TypedSupabaseClient } from '@/lib/db';
import { supabaseAdmin, supabaseAdminMaybe } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireOrg, requireRole } from '@/lib/auth/guards';

type RecentTransactionRow = {
  id: string;
  date: string | null;
  created_at: string | null;
  total_amount: number | null;
  memo: string | null;
  transaction_type: string | null;
};

type ActiveWorkOrderRow = {
  id: string;
  subject: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  created_at: string | null;
  scheduled_date: string | null;
};

type ExpiringLeaseRow = {
  id: number;
  lease_to_date: string | null;
  renewal_offer_status: string | null;
  status: string | null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const mergeKpis = (
  primary: {
    org_id: string | null;
    total_properties: number | null;
    total_units: number | null;
    occupied_units: number | null;
    available_units: number | null;
    occupancy_rate: number | null;
    monthly_rent_roll: number | null;
    active_leases: number | null;
    growth_rate: number | null;
    open_work_orders: number | null;
    urgent_work_orders: number | null;
  } | null,
  fallback: {
    org_id: string;
    total_properties: number;
    total_units: number;
    occupied_units: number;
    available_units: number;
    occupancy_rate: number;
    monthly_rent_roll: number;
    active_leases: number;
    growth_rate: number | null;
    open_work_orders: number;
    urgent_work_orders: number;
  } | null,
  orgId: string,
) => {
  const coalesceNumber = (value: unknown, fb?: number) => {
    const normalized = toNumber(value, Number.NaN);
    if (!Number.isNaN(normalized)) return normalized;
    if (typeof fb === 'number' && Number.isFinite(fb)) return fb;
    return 0;
  };

  const primaryTotals = {
    total_properties: coalesceNumber(primary?.total_properties),
    total_units: coalesceNumber(primary?.total_units),
    monthly_rent_roll: coalesceNumber(primary?.monthly_rent_roll),
  };
  const fallbackTotals = {
    total_properties: coalesceNumber(fallback?.total_properties),
    total_units: coalesceNumber(fallback?.total_units),
    monthly_rent_roll: coalesceNumber(fallback?.monthly_rent_roll),
  };

  const primaryScore =
    primaryTotals.total_properties + primaryTotals.total_units + primaryTotals.monthly_rent_roll;
  const fallbackScore =
    fallbackTotals.total_properties + fallbackTotals.total_units + fallbackTotals.monthly_rent_roll;

  const preferFallback = fallbackScore > primaryScore && fallbackScore > 0;
  const source = preferFallback ? fallback : primary;

  return {
    org_id: source?.org_id ?? primary?.org_id ?? fallback?.org_id ?? orgId,
    total_properties: coalesceNumber(source?.total_properties, fallback?.total_properties),
    total_units: coalesceNumber(source?.total_units, fallback?.total_units),
    occupied_units: coalesceNumber(source?.occupied_units, fallback?.occupied_units),
    available_units: coalesceNumber(source?.available_units, fallback?.available_units),
    occupancy_rate: coalesceNumber(source?.occupancy_rate, fallback?.occupancy_rate),
    monthly_rent_roll: coalesceNumber(source?.monthly_rent_roll, fallback?.monthly_rent_roll),
    active_leases: coalesceNumber(source?.active_leases, fallback?.active_leases),
    growth_rate:
      typeof source?.growth_rate === 'number'
        ? source.growth_rate
        : (fallback?.growth_rate ?? null),
    open_work_orders: coalesceNumber(source?.open_work_orders, fallback?.open_work_orders),
    urgent_work_orders: coalesceNumber(source?.urgent_work_orders, fallback?.urgent_work_orders),
  };
};

async function buildKpisFromTables(supabase: TypedSupabaseClient, orgId: string) {
  const [properties, rentRollNow, rentRollPrev, activeLeasesCount, workOrders] = await Promise.all([
    supabase
      .from('properties')
      .select('id,total_active_units,total_occupied_units,total_units')
      .eq('org_id', orgId),
    supabase
      .from('v_rent_roll_current_month')
      .select('rent_roll_amount')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('v_rent_roll_previous_month')
      .select('rent_roll_amount')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('lease')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['active', 'Active', 'ACTIVE']),
    supabase.from('work_orders').select('priority,status').eq('org_id', orgId),
  ]);

  const firstError =
    properties.error ||
    rentRollNow.error ||
    rentRollPrev.error ||
    activeLeasesCount.error ||
    workOrders.error;
  if (firstError) {
    throw firstError;
  }

  const propertyRows = properties.data ?? [];
  const propertyIds = propertyRows
    .map((row) => (row as { id?: string | null }).id)
    .filter(Boolean) as string[];
  const totals = propertyRows.reduce(
    (acc, row) => {
      const activeUnits =
        toNumber((row as { total_active_units?: number | null }).total_active_units) ||
        toNumber((row as { total_units?: number | null }).total_units);
      const occupied = toNumber(
        (row as { total_occupied_units?: number | null }).total_occupied_units,
      );
      const available = Math.max(activeUnits - occupied, 0);
      return {
        totalUnits: acc.totalUnits + activeUnits,
        occupied: acc.occupied + occupied,
        available: acc.available + available,
      };
    },
    { totalUnits: 0, occupied: 0, available: 0 },
  );

  // If aggregate columns are empty, backfill from units table to avoid zeros.
  let unitsFromDetail = { total: 0, occupied: 0, available: 0 };
  if (propertyIds.length) {
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('status,is_active,property_id')
      .in('property_id', propertyIds);
    if (unitsError) {
      throw unitsError;
    }
    const normalized = (units ?? []).filter(
      (u) => (u as { is_active?: boolean | null }).is_active ?? true,
    );
    const occupied = normalized.filter(
      (u) => (u as { status?: string | null }).status?.toLowerCase() === 'occupied',
    ).length;
    const vacant = normalized.filter(
      (u) => (u as { status?: string | null }).status?.toLowerCase() === 'vacant',
    ).length;
    const active = normalized.filter(
      (u) => (u as { status?: string | null }).status?.toLowerCase() !== 'inactive',
    ).length;
    unitsFromDetail = {
      total: active,
      occupied,
      available: Math.max(active - occupied, vacant, 0),
    };
  }

  const totalUnits = totals.totalUnits || unitsFromDetail.total;
  const occupiedUnits = totals.occupied || unitsFromDetail.occupied;
  const availableUnits = totals.available || unitsFromDetail.available;

  const monthlyRentRoll = toNumber(rentRollNow.data?.rent_roll_amount);
  const previousRentRoll = toNumber(rentRollPrev.data?.rent_roll_amount);
  const growthRate =
    previousRentRoll > 0
      ? Number((((monthlyRentRoll - previousRentRoll) / previousRentRoll) * 100).toFixed(2))
      : null;

  const openWorkOrders = (workOrders.data ?? []).filter((w) => {
    const status = (w as { status?: string | null }).status?.toLowerCase() || '';
    return status !== 'completed' && status !== 'cancelled';
  });
  const urgentWorkOrders = openWorkOrders.filter((w) => {
    const priority = (w as { priority?: string | null }).priority?.toLowerCase() || '';
    return priority === 'urgent' || priority === 'high';
  });

  return {
    org_id: orgId,
    total_properties: propertyRows.length,
    total_units: totalUnits,
    occupied_units: occupiedUnits,
    available_units: availableUnits,
    occupancy_rate: totalUnits > 0 ? Number(((occupiedUnits / totalUnits) * 100).toFixed(2)) : 0,
    monthly_rent_roll: monthlyRentRoll,
    active_leases: activeLeasesCount.count ?? 0,
    growth_rate: growthRate,
    open_work_orders: openWorkOrders.length,
    urgent_work_orders: urgentWorkOrders.length,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { supabase } = await requireRole([
      'org_staff',
      'org_manager',
      'org_admin',
      'platform_admin',
    ]);
    const { orgId } = await params;
    await requireOrg(orgId);
    const dataClient =
      (supabaseAdminMaybe as TypedSupabaseClient | undefined) ??
      (supabaseAdmin as TypedSupabaseClient) ??
      (supabase as TypedSupabaseClient);

    const now = Date.now();
    // Use start of today (midnight) for date comparisons since lease_to_date is a date field
    // Create date in UTC to match database timestamp without timezone
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfTodayIso = startOfToday.toISOString();
    const ninetyDaysFromNow = new Date(now + 90 * 24 * 60 * 60 * 1000);
    ninetyDaysFromNow.setUTCHours(23, 59, 59, 999); // End of day 90 days from now
    const ninetyDaysFromNowIso = ninetyDaysFromNow.toISOString();
    const url = new URL(req.url);
    const DEFAULT_WINDOW_HOURS = 24 * 7;
    const hoursParam = Number(url.searchParams.get('hours'));
    const hours = Number.isFinite(hoursParam) ? hoursParam : DEFAULT_WINDOW_HOURS;
    const windowHours = hours > 0 ? hours : DEFAULT_WINDOW_HOURS;
    const windowStart = new Date(now - windowHours * 60 * 60 * 1000);
    const windowStartDate = windowStart.toISOString().split('T')[0]; // YYYY-MM-DD format for date field

    // Debug: Log expiring leases query parameters
    const expiringLeasesDateFrom = startOfTodayIso.split('T')[0];
    const expiringLeasesDateTo = ninetyDaysFromNowIso.split('T')[0];
    process.stdout.write(
      `[Dashboard] Querying expiring leases: orgId=${orgId}, dateFrom=${expiringLeasesDateFrom}, dateTo=${expiringLeasesDateTo}\n`,
    );

    const [kpis, renewals, recentTx, activeWOs, expiringLeases] = await Promise.all([
      // Try v_dashboard_kpis first, fallback to buildKpisFromTables if it fails
      (async () => {
        try {
          const result = await (dataClient as any)
            .from('v_dashboard_kpis')
            .select(
              'org_id,total_properties,total_units,occupied_units,available_units,occupancy_rate,monthly_rent_roll,active_leases,growth_rate,open_work_orders,urgent_work_orders',
            )
            .eq('org_id', orgId)
            .maybeSingle();
          return result;
        } catch {
          return { data: null, error: null };
        }
      })(),
      dataClient
        .from('v_lease_renewals_summary')
        .select('critical,upcoming,future')
        .eq('org_id', orgId)
        .maybeSingle(),
      dataClient
        .from('v_recent_transactions_ranked')
        .select('id,date,total_amount,memo,transaction_type,created_at')
        .eq('org_id', orgId)
        .gte('date', windowStartDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .range(0, 49),
      dataClient
        .from('v_active_work_orders_ranked')
        .select('id,subject,description,priority,status,created_at,scheduled_date,rn')
        .eq('org_id', orgId)
        .lte('rn', 5)
        .order('rn', { ascending: true }),
      (async () => {
        // First, let's check all active leases for this org to debug
        const allActiveLeases = await dataClient
          .from('lease')
          .select('id,lease_to_date,renewal_offer_status,status,org_id')
          .eq('org_id', orgId)
          .in('status', ['active', 'Active', 'ACTIVE']);
        const activeCount = allActiveLeases.data?.length ?? 0;
        process.stdout.write(`[Dashboard] All active leases for org: count=${activeCount}\n`);
        if (allActiveLeases.error) {
          process.stdout.write(
            `[Dashboard] Error fetching active leases: ${allActiveLeases.error.message}\n`,
          );
        }
        if (activeCount > 0 && activeCount <= 5) {
          process.stdout.write(
            `[Dashboard] Sample leases: ${JSON.stringify(
              allActiveLeases.data?.map((l) => ({
                id: l.id,
                lease_to_date: l.lease_to_date,
                status: l.status,
              })),
            )}\n`,
          );
        }

        // Now query with date filters
        const dateFrom = startOfTodayIso.split('T')[0];
        const dateTo = ninetyDaysFromNowIso.split('T')[0];
        const result = await dataClient
          .from('lease')
          .select('id,lease_to_date,renewal_offer_status,status')
          .eq('org_id', orgId)
          .in('status', ['active', 'Active', 'ACTIVE'])
          .not('lease_to_date', 'is', null)
          .gte('lease_to_date', dateFrom) // Use date-only format YYYY-MM-DD
          .lte('lease_to_date', dateTo); // Use date-only format YYYY-MM-DD

        const filteredCount = result.data?.length ?? 0;
        process.stdout.write(
          `[Dashboard] Filtered expiring leases: count=${filteredCount}, dateFrom=${dateFrom}, dateTo=${dateTo}\n`,
        );
        if (result.error) {
          process.stdout.write(`[Dashboard] Filtered query error: ${result.error.message}\n`);
        }
        if (filteredCount > 0) {
          process.stdout.write(
            `[Dashboard] Expiring leases: ${JSON.stringify(result.data?.slice(0, 3))}\n`,
          );
        }

        return result;
      })(),
    ]);

    // Check for errors, with specific logging for expiring leases
    if (expiringLeases.error) {
      console.error('[Dashboard] Expiring leases query error:', {
        error: expiringLeases.error,
        message: expiringLeases.error.message,
        details: expiringLeases.error.details,
        hint: expiringLeases.error.hint,
        orgId,
      });
    }

    const error =
      kpis.error || renewals.error || recentTx.error || activeWOs.error || expiringLeases.error;
    if (error) {
      logger.error(
        { error, orgId, expiringLeasesError: expiringLeases.error },
        'Dashboard API error',
      );
      return NextResponse.json(
        { error: error.message || 'Failed to load dashboard' },
        { status: 500 },
      );
    }

    // Log expiring leases query results for debugging
    const expiringLeasesCount = expiringLeases.data?.length ?? 0;
    const dateFrom = startOfTodayIso.split('T')[0];
    const dateTo = ninetyDaysFromNowIso.split('T')[0];
    console.log('[Dashboard] Expiring leases query:', {
      orgId,
      count: expiringLeasesCount,
      dateFrom,
      dateTo,
      sampleLeases: expiringLeases.data?.slice(0, 3).map((l) => ({
        id: l.id,
        lease_to_date: l.lease_to_date,
        status: l.status,
        renewal_offer_status: l.renewal_offer_status,
      })),
    });
    logger.info(
      {
        orgId,
        expiringLeasesCount,
        startOfTodayIso: dateFrom,
        ninetyDaysFromNowIso: dateTo,
      },
      'Expiring leases query results',
    );

    let fallbackKpis: Awaited<ReturnType<typeof buildKpisFromTables>> | null = null;
    const fallbackClient =
      (supabaseAdminMaybe as TypedSupabaseClient | undefined) ??
      (supabaseAdmin as TypedSupabaseClient) ??
      (dataClient as TypedSupabaseClient);
    try {
      fallbackKpis = await buildKpisFromTables(fallbackClient, orgId);
    } catch (fallbackError) {
      logger.error({ fallbackError, orgId }, 'Failed to build KPI fallback from base tables');
    }

    const mergedKpis = mergeKpis((kpis.data as typeof fallbackKpis) ?? null, fallbackKpis, orgId);

    const renewalsData = renewals.data
      ? {
          critical_30: renewals.data.critical ?? 0,
          upcoming_60: renewals.data.upcoming ?? 0,
          future_90: renewals.data.future ?? 0,
        }
      : null;

    // v_property_onboarding_summary was dropped in cleanup migration
    const onboardingData = null;

    const recentTransactions = (recentTx.data ?? []) as RecentTransactionRow[];
    // Transactions are already filtered by date at the database level and sorted
    // Just map to the expected format
    const transactionsData = recentTransactions.map((t) => ({
      id: t.id,
      date: t.date,
      created_at: t.created_at,
      amount: t.total_amount ?? 0,
      memo: t.memo ?? null,
      property_name: null,
      type: t.transaction_type ?? null,
    }));

    const activeWorkOrders = (activeWOs.data ?? []) as ActiveWorkOrderRow[];
    const workOrdersData = activeWorkOrders.map((w) => ({
      id: w.id,
      title: w.subject ?? 'Work order',
      description: w.description ?? null,
      priority: w.priority ?? null,
      status: w.status ?? null,
      created_at: w.created_at,
      scheduled_date: w.scheduled_date ?? null,
      property_name: null,
    }));

    const bucketDefs = [
      { key: '0_30', label: '0 - 30 days', min: 0, max: 30 },
      { key: '31_60', label: '31 - 60 days', min: 31, max: 60 },
      { key: '61_90', label: '61 - 90 days', min: 61, max: 90 },
      { key: 'all', label: 'All (0-90 days)', min: 0, max: 90 },
    ] as const;

    const makeCounts = () => ({ notStarted: 0, offers: 0, renewals: 0, moveOuts: 0, total: 0 });
    const expiringBuckets: Record<
      (typeof bucketDefs)[number]['key'],
      {
        key: string;
        label: string;
        counts: {
          notStarted: number;
          offers: number;
          renewals: number;
          moveOuts: number;
          total: number;
        };
      }
    > = bucketDefs.reduce(
      (acc, def) => ({
        ...acc,
        [def.key]: { key: def.key, label: def.label, counts: makeCounts() },
      }),
      {} as Record<
        (typeof bucketDefs)[number]['key'],
        {
          key: string;
          label: string;
          counts: {
            notStarted: number;
            offers: number;
            renewals: number;
            moveOuts: number;
            total: number;
          };
        }
      >,
    );

    const normalizeStage = (status: string | null | undefined) => {
      const normalized = (status || '').toLowerCase();
      if (normalized === 'offered') return 'offers' as const;
      if (normalized === 'accepted' || normalized === 'renewed') return 'renewals' as const;
      if (normalized === 'declined' || normalized === 'expired') return 'moveOuts' as const;
      return 'notStarted' as const;
    };

    // Use start of today for consistent day calculations (UTC)
    const startOfTodayForCalc = new Date(startOfToday);
    const expiringLeaseRows = (expiringLeases.data ?? []) as ExpiringLeaseRow[];
    expiringLeaseRows.forEach((lease) => {
      const leaseTo = lease?.lease_to_date ? new Date(lease.lease_to_date) : null;
      if (!leaseTo || Number.isNaN(leaseTo.getTime())) return;
      // Set leaseTo to start of day in UTC for consistent comparison
      const leaseToStartOfDay = new Date(leaseTo);
      leaseToStartOfDay.setUTCHours(0, 0, 0, 0);
      const daysUntil = Math.floor(
        (leaseToStartOfDay.getTime() - startOfTodayForCalc.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil < 0) return;

      const stage = normalizeStage(lease?.renewal_offer_status);
      bucketDefs.forEach((bucket) => {
        if (daysUntil >= bucket.min && daysUntil <= bucket.max) {
          const target = expiringBuckets[bucket.key];
          target.counts[stage] += 1;
          target.counts.total += 1;
        }
      });
    });

    // Final debug output
    process.stdout.write(
      `[Dashboard] Final expiring leases buckets: ${JSON.stringify(
        bucketDefs.map((bucket) => ({
          key: bucket.key,
          counts: expiringBuckets[bucket.key].counts,
        })),
      )}\n`,
    );

    // Enhanced debug info
    const expiringLeasesResponse = {
      buckets: bucketDefs.map((bucket) => expiringBuckets[bucket.key]),
      // Debug info (remove after fixing)
      _debug: {
        rawLeaseCount: expiringLeases.data?.length ?? 0,
        dateFrom: startOfTodayIso.split('T')[0],
        dateTo: ninetyDaysFromNowIso.split('T')[0],
        orgId,
        processedLeases: expiringLeaseRows.length,
        sampleRawLeases: expiringLeases.data?.slice(0, 3).map((l) => ({
          id: l.id,
          lease_to_date: l.lease_to_date,
          status: l.status,
          renewal_offer_status: l.renewal_offer_status,
        })),
        bucketCounts: bucketDefs.map((bucket) => ({
          key: bucket.key,
          label: bucket.label,
          counts: expiringBuckets[bucket.key].counts,
        })),
      },
    };

    return new NextResponse(
      JSON.stringify({
        kpis: mergedKpis,
        renewals: renewalsData,
        onboarding: onboardingData,
        transactions: transactionsData,
        workOrders: workOrdersData,
        expiringLeases: expiringLeasesResponse,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (e: unknown) {
    console.error('[Dashboard API] ERROR:', e);
    process.stderr.write(`[Dashboard API] ERROR: ${e instanceof Error ? e.message : String(e)}\n`);
    const msg: string = e instanceof Error ? e.message : 'Internal Server Error';
    const status =
      msg === 'FORBIDDEN'
        ? 403
        : msg === 'UNAUTHENTICATED'
          ? 401
          : msg === 'ORG_FORBIDDEN'
            ? 403
            : 500;
    return NextResponse.json({ error: msg, _debug: { caughtError: String(e) } }, { status });
  }
}
