"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/db'

export type DashboardData = {
  kpis: {
    org_id: string
    total_properties: number
    total_units: number
    occupied_units: number
    available_units: number
    occupancy_rate_pct: number
    monthly_rent_roll: number
    active_leases: number
    growth_rate_pct: number | null
    open_work_orders: number
    urgent_work_orders: number
  } | null
  renewals: { critical_30: number; upcoming_60: number; future_90: number } | null
  onboarding: { in_progress: number; pending_approval: number; overdue: number } | null
  transactions: { id: string; date: string; amount: number; memo: string | null; property_name: string | null }[]
  workOrders: { id: string; title: string; description: string | null; priority: string; status: string; created_at: string; property_name: string | null }[]
}

async function fetchDashboard(orgId: string): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard/${orgId}`, { credentials: 'include' })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? 'Failed to load dashboard')
  return body as DashboardData
}

export function useDashboardMetrics(orgId?: string) {
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(orgId ?? null)
  const [data, setData] = useState<DashboardData | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const abortRef = useRef<AbortController | null>(null)

  // Resolve orgId from user claims if not provided
  useEffect(() => {
    let mounted = true
    if (orgId) {
      setResolvedOrgId(orgId)
      return
    }
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const claims = (data?.user?.app_metadata as any)?.claims
        const first = (claims?.org_ids ?? [])[0] as string | undefined
        if (mounted) setResolvedOrgId(first ?? null)
      } catch (e) {
        if (mounted) setResolvedOrgId(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [orgId])

  const load = useCallback(async () => {
    if (!resolvedOrgId) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setIsLoading(true)
    setError(undefined)
    try {
      const d = await fetchDashboard(resolvedOrgId)
      setData(d)
    } catch (e: any) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e)
      }
    } finally {
      setIsLoading(false)
    }
  }, [resolvedOrgId])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const refresh = useCallback(() => {
    load()
  }, [load])

  return { data, error, isLoading, refresh, orgId: resolvedOrgId }
}

