'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowUpDown,
  Building,
  Building2,
  Loader2,
  MapPin,
  Plus,
  Search,
  Users,
} from 'lucide-react'

import AddPropertyModal from '@/components/AddPropertyModal'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Cluster,
  PageBody,
  PageHeader,
  PageShell,
  Stack,
} from '@/components/layout/page-shell'

interface Property {
  id: string
  name: string
  addressLine1: string
  city?: string | null
  state?: string | null
  propertyType: string | null
  status: string
  createdAt: string
  totalActiveUnits?: number
  totalOccupiedUnits?: number
  totalVacantUnits?: number
  ownersCount?: number
  primaryOwnerName?: string
  operatingBankAccountId?: string | null
  depositTrustAccountId?: string | null
}

const statusOptions = [
  { value: 'all', label: 'All rentals' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
]

const typeOptions = [
  { value: 'all', label: 'Add filter option' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Co-op', label: 'Co-op' },
  { value: 'Condop', label: 'Condop' },
  { value: 'Rental Building', label: 'Rental Building' },
  { value: 'Mult-Family', label: 'Multi-Family' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'none', label: 'No type assigned' },
]

const filterableStrings = (property: Property) =>
  [property.name, property.addressLine1, property.city, property.state, property.primaryOwnerName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase())

const formatLocation = (property: Property) => {
  const parts = [property.city, property.state].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  if (parts.length > 0) return parts.join(', ')
  return property.addressLine1 || '—'
}

export default function PropertiesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false)
  const [startTourFromQuery, setStartTourFromQuery] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showBankAccounts, setShowBankAccounts] = useState(true)

  useEffect(() => {
    void fetchProperties()
  }, [])

  useEffect(() => {
    const wantsTour = searchParams.get('tour') === 'add-property'
    if (wantsTour) {
      setStartTourFromQuery(true)
      setIsAddPropertyModalOpen(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('tour')
      const qs = params.toString()
      router.replace(qs ? `/properties?${qs}` : '/properties', { scroll: false })
    }
  }, [router, searchParams])

  async function fetchProperties() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/properties')
      if (!res.ok) throw new Error('Failed to fetch properties')
      const data = await res.json()
      setProperties(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return properties.filter((property) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        filterableStrings(property).some((value) => value.includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || property.status === statusFilter
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'none'
          ? !property.propertyType
          : property.propertyType === typeFilter)
      return matchesSearch && matchesStatus && matchesType
    })
  }, [properties, searchTerm, statusFilter, typeFilter])

  const handlePropertyCreated = () => {
    void fetchProperties()
    setIsAddPropertyModalOpen(false)
    setStartTourFromQuery(false)
  }

  const handleCloseModal = () => {
    setIsAddPropertyModalOpen(false)
    setStartTourFromQuery(false)
  }

  let mainContent: ReactNode

  if (loading) {
    mainContent = (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Loading properties…</p>
        </CardContent>
      </Card>
    )
  } else if (error) {
    mainContent = (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="text-destructive">
            <Building className="h-10 w-10" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Unable to load properties</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => void fetchProperties()}>Try again</Button>
        </CardContent>
      </Card>
    )
  } else {
    const renderAccountStatus = (accountId: string | null | undefined, label: string) => {
      const hasAccount = Boolean(accountId)
      const textClass = hasAccount
        ? 'text-sm font-medium text-foreground'
        : 'text-sm font-medium text-primary'
      return (
        <Stack gap="xs">
          {hasAccount && showBankAccounts ? (
            <Cluster gap="xs" wrap={false}>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                EFT
              </span>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                ACH
              </span>
            </Cluster>
          ) : null}
          <span className={textClass}>{hasAccount ? label : 'Setup'}</span>
        </Stack>
      )
    }

    mainContent = (
      <Card className="overflow-hidden">
        <div className="border-border/80 flex flex-col gap-4 border-b bg-card px-6 py-4">
          <Stack gap="md" className="lg:flex-row lg:items-center lg:justify-between">
            <Cluster gap="sm" className="lg:flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All rentals" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Add filter option" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Cluster>
            <Cluster gap="md" className="lg:flex-none">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search properties"
                  className="w-56 pl-9"
                />
              </div>
              <Cluster gap="sm" wrap={false}>
                <Switch
                  id="properties-show-bank-accounts"
                  checked={showBankAccounts}
                  onCheckedChange={(checked) => setShowBankAccounts(Boolean(checked))}
                />
                <Label
                  htmlFor="properties-show-bank-accounts"
                  className="text-sm text-muted-foreground"
                >
                  Show bank accounts
                </Label>
              </Cluster>
            </Cluster>
          </Stack>
        </div>

        <div className="border-border/80 flex items-center justify-between border-b bg-card px-6 py-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'match' : 'matches'}
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Export
          </Button>
        </div>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">No properties found</h3>
                <p className="text-sm text-muted-foreground">
                  Adjust your filters or try a different search.
                </p>
              </div>
              {properties.length === 0 ? (
                <Button onClick={() => setIsAddPropertyModalOpen(true)} size="sm">
                  Add your first property
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-t border-border text-sm">
                <thead className="bg-muted/70 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">
                      <span className="flex items-center gap-2">
                        Property
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
                      </span>
                    </th>
                    <th className="px-6 py-3 font-semibold">Location</th>
                    <th className="px-6 py-3 font-semibold">Rental owners</th>
                    <th className="px-6 py-3 font-semibold">Manager</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Operating account</th>
                    <th className="px-6 py-3 font-semibold">Deposit trust account</th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {filtered.map((property) => {
                    const ownersCount = property.ownersCount ?? 0
                    const additionalOwners = ownersCount > 1 ? ownersCount - 1 : 0

                    return (
                      <tr
                        key={property.id}
                        className="border-b border-border/80 last:border-0 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-6 py-5 align-top">
                          <div className="flex items-start gap-3">
                            <div className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                            </div>
                            <Stack gap="xs" className="min-w-0">
                              <Link
                                href={`/properties/${property.id}`}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                {property.name}
                              </Link>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                <span className="truncate">{property.addressLine1}</span>
                              </div>
                            </Stack>
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-muted-foreground">
                          {formatLocation(property)}
                        </td>
                        <td className="px-6 py-5 align-top">
                          <Stack gap="xs">
                            <span className="text-sm font-medium text-foreground">
                              {property.primaryOwnerName ?? '—'}
                            </span>
                            {additionalOwners > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" aria-hidden="true" />
                                +{additionalOwners} more
                              </span>
                            ) : null}
                          </Stack>
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-muted-foreground">
                          Not assigned
                        </td>
                        <td className="px-6 py-5 align-top text-sm text-muted-foreground">
                          {property.propertyType ?? '—'}
                        </td>
                        <td className="px-6 py-5 align-top">
                          {renderAccountStatus(property.operatingBankAccountId, 'Trust account')}
                        </td>
                        <td className="px-6 py-5 align-top">
                          {renderAccountStatus(property.depositTrustAccountId, 'Deposit account')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Properties"
        description="Manage and monitor your property portfolio from a single view."
        actions={
          <Button onClick={() => setIsAddPropertyModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        }
      />
      <PageBody>
        <Stack gap="lg">{mainContent}</Stack>
      </PageBody>
      <AddPropertyModal
        isOpen={isAddPropertyModalOpen}
        onClose={handleCloseModal}
        onSuccess={handlePropertyCreated}
        startInTour={startTourFromQuery}
      />
    </PageShell>
  )
}
