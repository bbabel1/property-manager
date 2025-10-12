"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import AccountMultiSelect from "@/components/financials/AccountMultiSelect"

type Option = { id: string; label: string }

type Props = {
  defaultUnitIds: string[]
  defaultVendorIds: string[]
  defaultStatuses: string[]
  unitOptions: Option[]
  vendorOptions: Option[]
}

export default function BillsFilters({
  defaultUnitIds,
  defaultVendorIds,
  defaultStatuses,
  unitOptions,
  vendorOptions,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const allUnitIds = useMemo(() => unitOptions.map((u) => u.id), [unitOptions])
  const allVendorIds = useMemo(() => vendorOptions.map((v) => v.id), [vendorOptions])

  const [unitIds, setUnitIds] = useState<string[]>(defaultUnitIds)
  const [vendorIds, setVendorIds] = useState<string[]>(defaultVendorIds)
  const [statusIds, setStatusIds] = useState<string[]>(defaultStatuses)

  useEffect(() => setUnitIds(defaultUnitIds), [defaultUnitIds])
  useEffect(() => setVendorIds(defaultVendorIds), [defaultVendorIds])
  useEffect(() => setStatusIds(defaultStatuses), [defaultStatuses])

  const updateSearch = useCallback((mutator: (p: URLSearchParams) => void) => {
    const base = searchParams ? searchParams.toString() : ''
    const p = new URLSearchParams(base)
    mutator(p)
    const q = p.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const unitOptionsFormatted = useMemo(
    () => unitOptions.map((u) => ({ value: u.id, label: u.label, group: 'Units', groupLabel: 'Units' })),
    [unitOptions]
  )
  const vendorOptionsFormatted = useMemo(
    () => vendorOptions.map((v) => ({ value: v.id, label: v.label, group: 'Vendors', groupLabel: 'Vendors' })),
    [vendorOptions]
  )
  const statusOptionsFormatted = useMemo(
    () => [
      { value: 'overdue', label: 'Overdue', group: 'Status', groupLabel: 'Status' },
      { value: 'due', label: 'Due', group: 'Status', groupLabel: 'Status' },
      { value: 'partially-paid', label: 'Partially paid', group: 'Status', groupLabel: 'Status' },
      { value: 'paid', label: 'Paid', group: 'Status', groupLabel: 'Status' },
      { value: 'cancelled', label: 'Cancelled', group: 'Status', groupLabel: 'Status' },
    ],
    []
  )

  function handleUnitsChange(ids: string[]) {
    const next = ids.length ? ids : []
    setUnitIds(next)
    updateSearch((p) => {
      if (next.length === 0) p.set('units', 'none')
      else if (next.length === allUnitIds.length) p.delete('units')
      else p.set('units', next.join(','))
    })
  }

  function handleVendorsChange(ids: string[]) {
    setVendorIds(ids)
    updateSearch((p) => {
      if (!ids.length || ids.length === allVendorIds.length) p.delete('vendors')
      else p.set('vendors', ids.join(','))
    })
  }

  function handleStatusChange(ids: string[]) {
    setStatusIds(ids)
    updateSearch((p) => {
      const all = ['overdue', 'due', 'partially-paid', 'paid', 'cancelled']
      if (!ids.length || ids.length === all.length) p.delete('bstatus')
      else p.set('bstatus', ids.join(','))
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1 min-w-[16rem]">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unit</span>
        <AccountMultiSelect
          value={unitIds}
          onChange={handleUnitsChange}
          options={unitOptionsFormatted}
          placeholder="All units"
          hideGroupSidebar
          selectAllLabel="Select all units"
          clearAllLabel="Clear all units"
          className="min-w-[16rem]"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[16rem]">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendors</span>
        <AccountMultiSelect
          value={vendorIds}
          onChange={handleVendorsChange}
          options={vendorOptionsFormatted}
          placeholder="All vendors"
          hideGroupSidebar
          selectAllLabel="Select all vendors"
          clearAllLabel="Clear all vendors"
          className="min-w-[16rem]"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[16rem]">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
        <AccountMultiSelect
          value={statusIds}
          onChange={handleStatusChange}
          options={statusOptionsFormatted}
          placeholder="All statuses"
          hideGroupSidebar
          selectAllLabel="Select all statuses"
          clearAllLabel="Clear all statuses"
          className="min-w-[16rem]"
        />
      </div>
    </div>
  )
}
