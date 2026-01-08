"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import AccountMultiSelect from "@/components/financials/AccountMultiSelect"

type Option = { id: string; label: string }

type Props = {
  defaultPropertyIds: string[]
  defaultUnitIds: string[]
  defaultVendorIds: string[]
  defaultStatuses: string[]
  defaultApprovalStates?: string[]
  propertyOptions: Option[]
  unitOptions: Option[]
  vendorOptions: Option[]
  showPropertyFilter?: boolean
  showUnitFilter?: boolean
  showApprovalFilter?: boolean
}

export default function BillsFilters({
  defaultPropertyIds,
  defaultUnitIds,
  defaultVendorIds,
  defaultStatuses,
  defaultApprovalStates = ['draft', 'pending_approval', 'approved', 'rejected', 'voided'],
  propertyOptions,
  unitOptions,
  vendorOptions,
  showPropertyFilter = true,
  showUnitFilter = true,
  showApprovalFilter = false,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const allPropertyIds = useMemo(() => propertyOptions.map((p) => p.id), [propertyOptions])
  const allUnitIds = useMemo(() => unitOptions.map((u) => u.id), [unitOptions])
  const allVendorIds = useMemo(() => vendorOptions.map((v) => v.id), [vendorOptions])

  const [propertyIds, setPropertyIds] = useState<string[]>(defaultPropertyIds)
  const [unitIds, setUnitIds] = useState<string[]>(defaultUnitIds)
  const [vendorIds, setVendorIds] = useState<string[]>(defaultVendorIds)
  const [statusIds, setStatusIds] = useState<string[]>(defaultStatuses)
  const [approvalIds, setApprovalIds] = useState<string[]>(defaultApprovalStates)

  useEffect(() => setPropertyIds(defaultPropertyIds), [defaultPropertyIds])
  useEffect(() => setUnitIds(defaultUnitIds), [defaultUnitIds])
  useEffect(() => setVendorIds(defaultVendorIds), [defaultVendorIds])
  useEffect(() => setStatusIds(defaultStatuses), [defaultStatuses])
  useEffect(() => setApprovalIds(defaultApprovalStates), [defaultApprovalStates])

  const updateSearch = useCallback((mutator: (p: URLSearchParams) => void) => {
    const base = searchParams ? searchParams.toString() : ''
    const p = new URLSearchParams(base)
    mutator(p)
    const q = p.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const propertyOptionsFormatted = useMemo(
    () =>
      propertyOptions.map((p) => ({
        value: p.id,
        label: p.label,
        group: 'Properties',
        groupLabel: 'Properties',
      })),
    [propertyOptions],
  )
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
  const approvalOptionsFormatted = useMemo(
    () => [
      { value: 'draft', label: 'Draft', group: 'Approval', groupLabel: 'Approval' },
      { value: 'pending_approval', label: 'Pending approval', group: 'Approval', groupLabel: 'Approval' },
      { value: 'approved', label: 'Approved', group: 'Approval', groupLabel: 'Approval' },
      { value: 'rejected', label: 'Rejected', group: 'Approval', groupLabel: 'Approval' },
      { value: 'voided', label: 'Voided', group: 'Approval', groupLabel: 'Approval' },
    ],
    [],
  )

  function handlePropertiesChange(ids: string[]) {
    setPropertyIds(ids)
    updateSearch((p) => {
      if (!ids.length || ids.length === allPropertyIds.length) p.delete('properties')
      else p.set('properties', ids.join(','))
    })
  }

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

  function handleApprovalChange(ids: string[]) {
    setApprovalIds(ids)
    updateSearch((p) => {
      const all = ['draft', 'pending_approval', 'approved', 'rejected', 'voided']
      if (!ids.length || ids.length === all.length) p.delete('approval')
      else p.set('approval', ids.join(','))
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      {showPropertyFilter ? (
        <div className="flex flex-col gap-1 min-w-[16rem]">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Properties</span>
          <AccountMultiSelect
            value={propertyIds}
            onChange={handlePropertiesChange}
            options={propertyOptionsFormatted}
            placeholder="All properties"
            hideGroupSidebar
            selectAllLabel="Select all properties"
            clearAllLabel="Clear all properties"
            className="min-w-[16rem]"
          />
        </div>
      ) : null}
      {showUnitFilter && unitOptions.length ? (
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
      ) : null}
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
      {showApprovalFilter ? (
        <div className="flex flex-col gap-1 min-w-[16rem]">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval</span>
          <AccountMultiSelect
            value={approvalIds}
            onChange={handleApprovalChange}
            options={approvalOptionsFormatted}
            placeholder="All approval states"
            hideGroupSidebar
            selectAllLabel="Select all approval states"
            clearAllLabel="Clear all approval states"
            className="min-w-[16rem]"
          />
        </div>
      ) : null}
    </div>
  )
}
