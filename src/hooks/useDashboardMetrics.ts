'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/db';

export type ExpiringLeaseBucketKey = '0_30' | '31_60' | '61_90' | 'all'
export type ExpiringLeaseCounts = {
  notStarted: number
  offers: number
  renewals: number
  moveOuts: number
  total: number
}
export type ExpiringLeaseBucket = {
  key: ExpiringLeaseBucketKey
  label: string
  counts: ExpiringLeaseCounts
}

export type DashboardData = {
  kpis: {
    org_id: string
    total_properties: number
    total_units: number
    occupied_units: number
    available_units: number
    occupancy_rate: number
    monthly_rent_roll: number
    active_leases: number
    growth_rate: number | null
    open_work_orders: number
    urgent_work_orders: number
  } | null
  renewals: { critical_30: number; upcoming_60: number; future_90: number } | null
  onboarding: { in_progress: number; pending_approval: number; overdue: number } | null
  transactions: {
    id: string
    date: string
    created_at?: string
    amount: number
    memo: string | null
    property_name: string | null
    type?: string | null
  }[]
  workOrders: {
    id: string
    title: string
    description: string | null
    priority: string | null
    status: string | null
    created_at: string
    property_name: string | null
    scheduled_date?: string | null
  }[]
  expiringLeases: { buckets: ExpiringLeaseBucket[] } | null
};

type DashboardApiResponse = Partial<DashboardData> & { error?: string };

async function fetchDashboard(orgId: string, signal?: AbortSignal): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard/${orgId}`, { credentials: 'include', signal });
  const body = (await res.json().catch(() => ({}))) as DashboardApiResponse;
  if (!res.ok) throw new Error(body?.error ?? 'Failed to load dashboard');
  return body as DashboardData;
}

export function useDashboardMetrics(orgId?: string) {
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(orgId ?? null);
  const [data, setData] = useState<DashboardData | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const abortRef = useRef<AbortController | null>(null);

  // Resolve orgId from user claims if not provided
  useEffect(() => {
    let mounted = true;
    if (orgId) {
      setResolvedOrgId(orgId);
      return;
    }
    (async () => {
      try {
        setIsLoading(true);
        const { data } = await supabase.auth.getUser();
        const claims = (
          data?.user?.app_metadata as { claims?: { org_ids?: (string | number)[] } } | null | undefined
        )?.claims;
        const first = claims?.org_ids?.[0];
        if (first != null) {
          if (mounted) setResolvedOrgId(String(first));
          return;
        }

        // Fallback to org_memberships when token claims don't include org_ids
        const userId = data?.user?.id;
        if (userId) {
          const { data: memberships } = await supabase
            .from('org_memberships')
            .select('org_id')
            .eq('user_id', userId)
            .limit(1);

          const fallback = memberships?.[0]?.org_id ? String(memberships[0].org_id) : null;
          if (mounted) setResolvedOrgId(fallback);
          return;
        }

        if (mounted) setResolvedOrgId(null);
	      } catch {
        if (mounted) setResolvedOrgId(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orgId]);

  const load = useCallback(async () => {
    if (!resolvedOrgId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    setError(undefined);
    try {
      const d = await fetchDashboard(resolvedOrgId, ctrl.signal);
      setData(d);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e : new Error('Failed to load dashboard'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [resolvedOrgId]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  return { data, error, isLoading, refresh, orgId: resolvedOrgId };
}
