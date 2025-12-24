"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import AccountMultiSelect, { AccountOption } from "@/components/financials/AccountMultiSelect"

interface Option {
  id: string
  label: string
}

interface Props {
  defaultPropertyIds?: string[]
  defaultUnitIds: string[]
  defaultGlIds: string[]
  unitOptions: Option[]
  accountOptions: AccountOption[]
  noUnitsSelected: boolean
  propertyOptions?: Option[]
  showPropertyFilter?: boolean
  autoSelectAllProperties?: boolean
}

export default function LedgerFilters({
  defaultPropertyIds = [],
  defaultUnitIds,
  defaultGlIds,
  unitOptions,
  accountOptions,
  noUnitsSelected,
  propertyOptions,
  showPropertyFilter = true,
  autoSelectAllProperties = true,
}: Props) {
  const propertyList = useMemo(() => propertyOptions ?? [], [propertyOptions])
  const showPropertySelector = showPropertyFilter && propertyList.length > 0

  const allPropertyIds = useMemo(() => propertyList.map((property) => property.id), [propertyList])
  const allUnitIds = useMemo(() => unitOptions.map((unit) => unit.id), [unitOptions])
  const allAccountIds = useMemo(() => accountOptions.map((account) => account.value), [accountOptions])

  const propertyAccountOptions = useMemo(
    () =>
      propertyList.map((property) => ({
        value: property.id,
        label: property.label,
        group: 'Properties',
        groupLabel: 'Properties',
      })),
    [propertyList]
  )
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

  const [selectedProperties, setSelectedProperties] = useState<string[]>(() => {
    if (!showPropertySelector) return []
    if (defaultPropertyIds.length) {
      const matching = defaultPropertyIds.filter((id) => allPropertyIds.includes(id))
      if (matching.length) return matching
    }
    return autoSelectAllProperties ? [...allPropertyIds] : []
  })
  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    defaultUnitIds.length ? defaultUnitIds : []
  )
  const [unitPlaceholder, setUnitPlaceholder] = useState<string>(() =>
    deriveUnitsPlaceholder(defaultUnitIds, noUnitsSelected)
  )
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(defaultGlIds)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setSelectedUnits(defaultUnitIds)
  }, [defaultUnitIds])

  useEffect(() => {
    if (!showPropertySelector) return
    if (defaultPropertyIds.length) {
      const filtered = defaultPropertyIds.filter((id) => allPropertyIds.includes(id))
      if (filtered.length) {
        setSelectedProperties(filtered)
        return
      }
    }
    setSelectedProperties(autoSelectAllProperties ? [...allPropertyIds] : [])
  }, [allPropertyIds, autoSelectAllProperties, defaultPropertyIds, showPropertySelector])

  useEffect(() => {
    setUnitPlaceholder(deriveUnitsPlaceholder(defaultUnitIds, noUnitsSelected))
  }, [defaultUnitIds, noUnitsSelected, deriveUnitsPlaceholder])

  useEffect(() => {
    setSelectedAccounts(defaultGlIds)
  }, [defaultGlIds])

  const updateSearch = useCallback((mutator: (params: URLSearchParams) => void) => {
    const base = searchParams ? searchParams.toString() : ''
    const params = new URLSearchParams(base)
    mutator(params)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  function handlePropertiesChange(ids: string[]) {
    if (!showPropertySelector) return
    const filtered = ids.filter((id) => allPropertyIds.includes(id))
    const fallback = autoSelectAllProperties ? [...allPropertyIds] : []
    const nextSelection = filtered.length ? filtered : fallback
    setSelectedProperties(nextSelection)
    updateSearch((params) => {
      if (nextSelection.length === allPropertyIds.length) {
        params.delete("properties")
      } else if (nextSelection.length === 0) {
        if (autoSelectAllProperties) {
          params.delete("properties")
        } else {
          params.set("properties", "none")
        }
      } else {
        params.set("properties", nextSelection.join(","))
      }
    })
  }

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
    const next = ids.length ? ids : []
    setSelectedAccounts(next)
    updateSearch((params) => {
      if (next.length === 0) {
        params.set("gl", "none")
      } else if (next.length === allAccountIds.length) {
        params.delete("gl")
      } else {
        params.set("gl", next.join(","))
      }
    })
  }

  const accountsPlaceholder = selectedAccounts.length === 0 ? "No accounts selected" : "All accounts"

  return (
    <div className="flex flex-wrap items-end gap-4">
      {showPropertySelector ? (
        <div className="flex flex-col gap-1 min-w-[16rem]">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Property</span>
          <AccountMultiSelect
            value={selectedProperties}
            onChange={handlePropertiesChange}
            options={propertyAccountOptions}
            placeholder={autoSelectAllProperties ? "All properties" : "Select properties"}
            hideGroupSidebar
            selectAllLabel="Select all properties"
            clearAllLabel="Clear all properties"
            className="min-w-[16rem]"
          />
        </div>
      ) : null}
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
          placeholder={accountsPlaceholder}
          className="min-w-[16rem]"
        />
      </div>
    </div>
  )
}
