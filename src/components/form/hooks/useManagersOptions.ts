"use client"

import { useEffect, useState } from "react"
import { normalizeStaffRole } from '@/lib/staff-role'

export type ManagerOption = { value: string; label: string }

export function useManagersOptions(editing: boolean) {
  const [options, setOptions] = useState<ManagerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/staff')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          const list = (Array.isArray(data) ? data : [])
            .filter((s: any) => normalizeStaffRole(s.role) === 'Property Manager')
            .map((s: any) => ({ value: String(s.id), label: s.displayName || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff ${s.id}` }))
          setOptions(list)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load managers')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editing])

  return { options, loading, error }
}
