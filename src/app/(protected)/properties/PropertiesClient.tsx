'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { Label as FormLabel } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Body, Label as TextLabel } from '@/ui/typography'

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
  propertyManagerName?: string | null
  operatingBankAccountId?: string | null
  operatingBankAccountName?: string | null
  operatingBankAccountLast4?: string | null
  depositTrustAccountId?: string | null
  depositTrustAccountName?: string | null
  depositTrustAccountLast4?: string | null
}

interface PropertiesResponse {
  data: Property[]
  page: number
  pageSize: number
  total: number
}

const statusOptions = [
  { value: 'all', label: 'All rentals' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
]

const typeOptions = [
  { value: 'all', label: 'All types' },
  { value: 'Condo', label: 'Condo' },
  { value: 'Co-op', label: 'Co-op' },
  { value: 'Condop', label: 'Condop' },
  { value: 'Rental Building', label: 'Rental Building' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'none', label: 'No type assigned' },
]

const formatLocation = (property: Property) => {
  const parts = [property.city, property.state].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  if (parts.length > 0) return parts.join(', ')
  return property.addressLine1 || '—'
}

type PropertiesClientProps = {
  initialData: Property[]
  initialTotal: number
  initialPage: number
  initialPageSize: number
  initialSearch?: string
  initialStatus?: string
  initialType?: string
}

export default function PropertiesClient({
  initialData,
  initialTotal,
  initialPage,
  initialPageSize,
  initialSearch = '',
  initialStatus = 'all',
  initialType = 'all',
}: PropertiesClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false)
  const [startTourFromQuery, setStartTourFromQuery] = useState(false)
  const [properties, setProperties] = useState<Property[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(initialPageSize)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [typeFilter, setTypeFilter] = useState(initialType)
  const [showBankAccounts, setShowBankAccounts] = useState(true)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [exporting, setExporting] = useState(false)
  const skipFirstFetchRef = useRef(false)

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

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
    }, 250)
    return () => clearTimeout(handle)
  }, [searchTerm])

  const buildQueryString = useCallback(
    (overrides?: Partial<{ page: number; pageSize: number; search: string; status: string; type: string; dir: 'asc' | 'desc' }>) => {
      const params = new URLSearchParams()
      const nextPage = overrides?.page ?? page
      params.set('page', String(nextPage))
      params.set('pageSize', String(overrides?.pageSize ?? pageSize))
      params.set('dir', overrides?.dir ?? sortDir)
      const searchValue = overrides?.search ?? debouncedSearch
      const statusValue = overrides?.status ?? statusFilter
      const typeValue = overrides?.type ?? typeFilter
      if (searchValue) params.set('search', searchValue)
      if (statusValue && statusValue !== 'all') params.set('status', statusValue)
      if (typeValue && typeValue !== 'all') params.set('type', typeValue)
      return params.toString()
    },
    [page, pageSize, debouncedSearch, statusFilter, typeFilter, sortDir],
  )

  const fetchProperties = useCallback(
    async (opts?: Partial<{ page: number; search: string; status: string; type: string; dir: 'asc' | 'desc' }>) => {
      setLoading(true)
      setError(null)
      try {
        const query = buildQueryString(opts)
        const res = await fetch(`/api/properties?${query}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to fetch properties (HTTP ${res.status})`)
        const json = (await res.json()) as PropertiesResponse
        setProperties(Array.isArray(json.data) ? json.data : [])
        setTotal(typeof json.total === 'number' ? json.total : (json.data?.length ?? 0))
        setPage(json.page || opts?.page || 1)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load properties')
      } finally {
        setLoading(false)
      }
    },
    [buildQueryString],
  )

  useEffect(() => {
    if (!skipFirstFetchRef.current) {
      skipFirstFetchRef.current = true
      return
    }
    void fetchProperties({ page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, typeFilter, sortDir])

  const handlePropertyCreated = () => {
    void fetchProperties({ page: 1 })
    setIsAddPropertyModalOpen(false)
    setStartTourFromQuery(false)
  }

  const handleCloseModal = () => {
    setIsAddPropertyModalOpen(false)
    setStartTourFromQuery(false)
  }

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1) return
      const pageCountSafe = Math.max(1, Math.ceil(total / pageSize))
      if (nextPage > pageCountSafe) return
      void fetchProperties({ page: nextPage })
    },
    [fetchProperties, pageSize, total],
  )

  const handleExport = async () => {
    if (total === 0 || exporting) return
    setExporting(true)
    try {
      const pageCount = Math.max(1, Math.ceil(total / pageSize))
      const rows: Property[] = []
      for (let p = 1; p <= pageCount; p += 1) {
        const query = buildQueryString({ page: p })
        const res = await fetch(`/api/properties?${query}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Export fetch failed on page ${p}`)
        const json = (await res.json()) as PropertiesResponse
        rows.push(...(json.data || []))
        if (rows.length >= total) break
      }
      const headers = [
        'Property',
        'Location',
        'Rental owners',
        'Manager',
        'Type',
        'Operating account',
        'Deposit trust account',
        'Status',
      ]
      const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
      const csvRows = rows.map((property) => {
        const location = formatLocation(property)
        const owners = property.primaryOwnerName ?? '—'
        const manager = property.propertyManagerName || 'Not assigned'
        const type = property.propertyType ?? '—'
        const op = property.operatingBankAccountId ? 'Linked' : 'Setup'
        const dep = property.depositTrustAccountId ? 'Linked' : 'Setup'
        const status = property.status || '—'
        return [property.name, location, owners, manager, type, op, dep, status].map((cell) =>
          escape(String(cell)),
        )
      })
      const csv = [headers.map(escape), ...csvRows].map((row) => row.join(',')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'properties.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export properties')
    } finally {
      setExporting(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : rangeStart + properties.length - 1

  let mainContent: ReactNode
  if (loading) {
    mainContent = <LoadingState title="Loading properties…" />
  } else if (error) {
    mainContent = (
      <ErrorState
        title="Unable to load properties"
        description={error}
        onRetry={() => void fetchProperties({ page })}
        icon={<Building className="h-10 w-10 text-destructive" aria-hidden="true" />}
      />
    )
  } else if (properties.length === 0) {
    mainContent = (
      <EmptyState
        title="No properties found"
        description="Adjust your filters or try a different search."
        icon={<Building2 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />}
        action={
          total === 0 ? (
            <Button onClick={() => setIsAddPropertyModalOpen(true)} size="sm">
              Add your first property
            </Button>
          ) : null
        }
      />
    )
  } else {
    mainContent = (
      <Card className="overflow-hidden">
        <div className="border-border/80 flex flex-col gap-4 border-b bg-card px-6 py-4">
          <Stack gap="md" className="lg:flex-row lg:items-center lg:justify-between">
            <Cluster gap="sm" className="lg:flex-1">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
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
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All types" />
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
                <FormLabel
                  htmlFor="properties-show-bank-accounts"
                  size="sm"
                  tone="muted"
                >
                  Show bank accounts
                </FormLabel>
              </Cluster>
            </Cluster>
          </Stack>
        </div>

        <div className="border-border/80 flex items-center justify-between border-b bg-card px-6 py-3">
          <Body as="p" size="sm" tone="muted">
            {total} {total === 1 ? 'match' : 'matches'}
          </Body>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleExport}
            disabled={total === 0 || exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            Export
          </Button>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table density="comfortable" className="min-w-full border-t border-border">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = sortDir === 'asc' ? 'desc' : 'asc'
                          setSortDir(next)
                          setPage(1)
                        }}
                        className="flex items-center gap-1 text-left text-foreground transition hover:text-primary"
                        aria-label="Sort by property name"
                      >
                        <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                          Property
                        </TextLabel>
                        <ArrowUpDown
                          className={`h-3.5 w-3.5 transition ${sortDir === 'asc' ? 'rotate-0' : 'rotate-180'} text-muted-foreground/70`}
                          aria-hidden="true"
                        />
                      </button>
                    </span>
                  </TableHead>
                  <TableHead className="px-6 py-3">
                    <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Location
                    </TextLabel>
                  </TableHead>
                  <TableHead className="px-6 py-3">
                    <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Rental owners
                    </TextLabel>
                  </TableHead>
                  <TableHead className="px-6 py-3">
                    <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Manager
                    </TextLabel>
                  </TableHead>
                  <TableHead className="px-6 py-3">
                    <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Type
                    </TextLabel>
                  </TableHead>
                  <TableHead className="px-6 py-3">
                    <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Operating account
                    </TextLabel>
                  </TableHead>
                  <TableHead className="px-6 py-3">
                    <TextLabel as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                      Deposit trust account
                    </TextLabel>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card">
                {properties.map((property) => {
                  const ownersCount = property.ownersCount ?? 0
                  const additionalOwners = ownersCount > 1 ? ownersCount - 1 : 0

                  const renderAccountStatus = (
                    account: {
                      id?: string | null
                      name?: string | null
                      last4?: string | null
                    },
                  ) => {
                    const hasAccount = Boolean(account?.id)
                    const accountName = account?.name?.trim()
                    const last4 = account?.last4 ? `•••• ${String(account.last4).slice(-4)}` : null
                    const displayLabel =
                      accountName || last4 ? [accountName, last4].filter(Boolean).join(' · ') : 'Configured'
                    return (
                      <Stack gap="xs">
                        {hasAccount && showBankAccounts ? (
                          <Cluster gap="xs" wrap={false}>
                            <TextLabel
                              as="span"
                              size="xs"
                              tone="muted"
                              className="rounded-full border border-border bg-card px-2 py-0.5 uppercase tracking-wide"
                            >
                              EFT
                            </TextLabel>
                            <TextLabel
                              as="span"
                              size="xs"
                              tone="muted"
                              className="rounded-full border border-border bg-card px-2 py-0.5 uppercase tracking-wide"
                            >
                              ACH
                            </TextLabel>
                          </Cluster>
                        ) : null}
                        <TextLabel as="span" size="sm" className={hasAccount ? undefined : 'text-primary'}>
                          {hasAccount ? displayLabel : 'Setup'}
                        </TextLabel>
                      </Stack>
                    )
                  }

                  return (
                    <TableRow
                      key={property.id}
                      density="comfortable"
                      className="border-b border-border/80 last:border-0"
                    >
                      <TableCell density="comfortable" className="px-6 align-top">
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                          </div>
                          <Stack gap="xs" className="min-w-0">
                            <TextLabel as={Link} href={`/properties/${property.id}`} size="sm" className="text-primary hover:underline">
                              {property.name}
                            </TextLabel>
                            <Body as="div" size="xs" tone="muted" className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              <span className="truncate">{property.addressLine1}</span>
                            </Body>
                          </Stack>
                        </div>
                      </TableCell>
                      <TableCell density="comfortable" className="px-6 align-top">
                        <Body as="span" size="sm" tone="muted">
                          {formatLocation(property)}
                        </Body>
                      </TableCell>
                      <TableCell density="comfortable" className="px-6 align-top">
                        <Stack gap="xs">
                          <TextLabel as="span" size="sm">
                            {property.primaryOwnerName ?? '—'}
                          </TextLabel>
                          {additionalOwners > 0 ? (
                            <Body as="span" size="xs" tone="muted" className="flex items-center gap-1">
                              <Users className="h-3 w-3" aria-hidden="true" />
                              +{additionalOwners} more
                            </Body>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell density="comfortable" className="px-6 align-top">
                        <Body as="span" size="sm" tone="muted">
                          {property.propertyManagerName || 'Not assigned'}
                        </Body>
                      </TableCell>
                      <TableCell density="comfortable" className="px-6 align-top">
                        <Body as="span" size="sm" tone="muted">
                          {property.propertyType ?? '—'}
                        </Body>
                      </TableCell>
                      <TableCell density="comfortable" className="px-6 align-top">
                        {renderAccountStatus({
                          id: property.operatingBankAccountId,
                          name: property.operatingBankAccountName,
                          last4: property.operatingBankAccountLast4,
                        })}
                      </TableCell>
                      <TableCell density="comfortable" className="px-6 align-top">
                        {renderAccountStatus({
                          id: property.depositTrustAccountId,
                          name: property.depositTrustAccountName,
                          last4: property.depositTrustAccountLast4,
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <div className="border-border/80 flex items-center justify-between border-t bg-card px-6 py-3">
          <Body as="span" size="sm" tone="muted">
            Showing {rangeStart}-{rangeEnd} of {total} {total === 1 ? 'property' : 'properties'}
          </Body>
          <Cluster gap="sm">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <TextLabel as="span" size="xs" tone="muted">
              Page {page} of {pageCount}
            </TextLabel>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pageCount}
            >
              Next
            </Button>
          </Cluster>
        </div>
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
