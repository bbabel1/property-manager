"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import AccountMultiSelect, { AccountOption } from "@/components/financials/AccountMultiSelect"

interface Option {
  id: string
  label: string
}

interface Props {
  defaultUnitIds: string[]
  defaultGlIds: string[]
  unitOptions: Option[]
  accountOptions: AccountOption[]
  noUnitsSelected: boolean
}

export default function LedgerFilters({
  defaultUnitIds,
  defaultGlIds,
  unitOptions,
  accountOptions,
  noUnitsSelected,
}: Props) {
  const allUnitIds = useMemo(() => unitOptions.map((unit) => unit.id), [unitOptions])
  const allAccountIds = useMemo(() => accountOptions.map((account) => account.value), [accountOptions])

  const unitAccountOptions = useMemo(
    () => unitOptions.map((unit) => ({ value: unit.id, label: unit.label, group: 'Units', groupLabel: 'Units' })),
    [unitOptions]
  )

  const deriveUnitsPlaceholder = useCallback(
    (ids: string[], treatedAsNone: boolean) => {
      if (unitOptions.length === 0) return 'No units available'
      if (treatedAsNone) return 'No units selected'
      if (ids.length === allUnitIds.length || ids.length === 0) return 'All units'
      return 'All units'
    },
    [allUnitIds.length, unitOptions.length]
  )

  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    defaultUnitIds.length ? defaultUnitIds : []
  )
  const [unitPlaceholder, setUnitPlaceholder] = useState<string>(() =>
    deriveUnitsPlaceholder(defaultUnitIds, noUnitsSelected)
  )
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    defaultGlIds.length ? defaultGlIds : allAccountIds
  )

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setSelectedUnits(defaultUnitIds)
  }, [defaultUnitIds])

  useEffect(() => {
    setUnitPlaceholder(deriveUnitsPlaceholder(defaultUnitIds, noUnitsSelected))
  }, [defaultUnitIds, noUnitsSelected, deriveUnitsPlaceholder])

  useEffect(() => {
    setSelectedAccounts(defaultGlIds.length ? defaultGlIds : allAccountIds)
  }, [allAccountIds, defaultGlIds])

  const updateSearch = useCallback((mutator: (params: URLSearchParams) => void) => {
    const base = searchParams ? searchParams.toString() : ''
    const params = new URLSearchParams(base)
    mutator(params)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  function handleUnitsChange(ids: string[]) {
    const next = ids.length ? ids : []
    setSelectedUnits(next.length ? next : [])
    setUnitPlaceholder(deriveUnitsPlaceholder(next, next.length === 0 && allUnitIds.length > 0))
    updateSearch((params) => {
      if (!next.length) {
        params.set("units", "none")
      } else if (next.length === allUnitIds.length) {
        params.delete("units")
        params.delete("unit")
      } else {
        params.set("units", next.join(","))
      }
    })
  }

  function handleAccountsChange(ids: string[]) {
    setSelectedAccounts(ids)
    updateSearch((params) => {
      if (!ids.length || ids.length === allAccountIds.length) {
        params.delete("gl")
      } else {
        params.set("gl", ids.join(","))
      }
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1 min-w-[16rem]">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Units</span>
        <AccountMultiSelect
          value={selectedUnits}
          onChange={handleUnitsChange}
          options={unitAccountOptions}
          placeholder={unitPlaceholder}
          hideGroupSidebar
          selectAllLabel="Select all units"
          clearAllLabel="Clear all units"
          className="min-w-[16rem]"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[16rem]">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accounts</span>
        <AccountMultiSelect
          value={selectedAccounts}
          onChange={handleAccountsChange}
          options={accountOptions}
          placeholder="All accounts"
          className="min-w-[16rem]"
        />
      </div>
    </div>
  )
}
