"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import AccountMultiSelect from "@/components/financials/AccountMultiSelect"

type VendorOption = { id: string; label: string }
type StatusOption = { value: string; label: string }

type Props = {
  vendorOptions: VendorOption[]
  selectedVendorIds: string[]
  statusOptions: StatusOption[]
  selectedStatusIds: string[]
}

export default function UnitBillsFilters({
  vendorOptions,
  selectedVendorIds,
  statusOptions,
  selectedStatusIds,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [vendorIds, setVendorIds] = useState<string[]>(selectedVendorIds)
  const [statusIds, setStatusIds] = useState<string[]>(selectedStatusIds)

  useEffect(() => setVendorIds(selectedVendorIds), [selectedVendorIds])
  useEffect(() => setStatusIds(selectedStatusIds), [selectedStatusIds])

  const vendorOptionsFormatted = useMemo(
    () =>
      vendorOptions.map((option) => ({
        value: option.id,
        label: option.label,
        group: "Vendors",
        groupLabel: "Vendors",
      })),
    [vendorOptions],
  )
  const statusOptionsFormatted = useMemo(
    () =>
      statusOptions.map((option) => ({
        value: option.value,
        label: option.label,
        group: "Status",
        groupLabel: "Status",
      })),
    [statusOptions],
  )

  const allVendorIds = useMemo(() => vendorOptions.map((option) => option.id), [vendorOptions])
  const allStatusIds = useMemo(() => statusOptions.map((option) => option.value), [statusOptions])

  const updateSearch = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "")
      mutator(params)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  function handleVendorChange(ids: string[]) {
    setVendorIds(ids)
    updateSearch((params) => {
      if (!ids.length || ids.length === allVendorIds.length) params.delete("vendors")
      else params.set("vendors", ids.join(","))
    })
  }

  function handleStatusChange(ids: string[]) {
    setStatusIds(ids)
    updateSearch((params) => {
      if (!ids.length || ids.length === allStatusIds.length) params.delete("bstatus")
      else params.set("bstatus", ids.join(","))
    })
  }

  if (vendorOptions.length === 0 && statusOptions.length === 0) return null

  return (
    <div className="flex flex-wrap items-end gap-4">
      {vendorOptions.length ? (
        <div className="flex min-w-[16rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendors</span>
          <AccountMultiSelect
            value={vendorIds}
            onChange={handleVendorChange}
            options={vendorOptionsFormatted}
            placeholder="All vendors"
            hideGroupSidebar
            selectAllLabel="Select all vendors"
            clearAllLabel="Clear all vendors"
            className="min-w-[16rem]"
          />
        </div>
      ) : null}
      {statusOptions.length ? (
        <div className="flex min-w-[16rem] flex-col gap-1">
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
      ) : null}
    </div>
  )
}
