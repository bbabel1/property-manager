'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Building2, Home, MapPin, Search } from 'lucide-react'

import { PageBody, PageHeader, PageShell, Stack } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

type BuildingSummary = {
  id: string
  streetAddress: string
  city: string | null
  state: string | null
  postalCode: string | null
  borough: string | null
  neighborhood: string | null
  ntaName: string | null
  bbl: string | null
  bin: string | null
  parid: string | null
  latitude: number | null
  longitude: number | null
  occupancyGroup: string | null
  occupancyDescription: string | null
  isOneTwoFamily: boolean | null
  isPrivateResidenceBuilding: boolean | null
  dwellingUnitCount: number | null
  totalUnits: number
  occupiedUnits: number
  vacantUnits: number
  occupancyRate: number
  properties: Array<{
    id: string
    name: string
    status: string | null
    addressLine1: string | null
    city: string | null
    state: string | null
  }>
}

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [boroughFilter, setBoroughFilter] = useState('all')

  const fetchBuildings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/buildings')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to fetch buildings')
      }
      const data = await res.json()
      setBuildings(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load buildings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBuildings()
  }, [fetchBuildings])

  const boroughOptions = useMemo(() => {
    const unique = new Set<string>()
    for (const b of buildings) {
      if (b.borough) unique.add(b.borough)
    }
    return Array.from(unique)
  }, [buildings])

  const filtered = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return buildings.filter((b) => {
      const matchesBorough = boroughFilter === 'all' || b.borough === boroughFilter
      const haystack = [
        b.streetAddress,
        b.city ?? '',
        b.state ?? '',
        b.borough ?? '',
        ...b.properties.map((p) => p.name || ''),
      ]
        .join(' ')
        .toLowerCase()
      const matchesSearch = normalizedSearch.length === 0 || haystack.includes(normalizedSearch)
      return matchesBorough && matchesSearch
    })
  }, [boroughFilter, buildings, searchTerm])

  let mainContent: ReactNode

  if (loading) {
    mainContent = (
      <Card className="overflow-hidden">
        <CardContent className="divide-y divide-border p-0">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 px-6 py-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  } else if (error) {
    mainContent = (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Building2 className="h-8 w-8 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Unable to load buildings</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button size="sm" onClick={() => void fetchBuildings()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  } else if (filtered.length === 0) {
    mainContent = (
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">No buildings found</p>
            <p className="text-sm text-muted-foreground">Adjust your search or borough filter.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setBoroughFilter('all')
              void fetchBuildings()
            }}
          >
            Clear filters
          </Button>
        </CardContent>
      </Card>
    )
  } else {
    mainContent = (
      <Card className="overflow-hidden">
        <div className="border-border/80 flex items-center justify-between border-b bg-card px-6 py-3 text-sm text-muted-foreground">
          <span>{filtered.length} {filtered.length === 1 ? 'building' : 'buildings'}</span>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-semibold">Building</th>
                  <th className="px-6 py-3 font-semibold">Borough</th>
                  <th className="px-6 py-3 font-semibold">Properties</th>
                  <th className="px-6 py-3 font-semibold">Occupancy</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {filtered.map((building) => {
                  const location = [building.city, building.state].filter(Boolean).join(', ')
                  const totalUnits = building.totalUnits || building.dwellingUnitCount || 0
                  const occupiedUnits = building.occupiedUnits
                  const occupancyRate = totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0
                  const propertyPreview = building.properties.slice(0, 2)
                  const extraProperties = building.properties.length - propertyPreview.length

                  return (
                    <tr key={building.id} className="border-b border-border/80 last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-4 align-top">
                        <Stack gap="xs">
                          <Link href={`/buildings/${building.id}`} className="font-semibold text-primary hover:underline">
                            {building.streetAddress}
                          </Link>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{location || 'Location pending'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {building.bbl ? <Badge variant="outline">BBL {building.bbl}</Badge> : null}
                            {building.bin ? <Badge variant="outline">BIN {building.bin}</Badge> : null}
                          </div>
                        </Stack>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-foreground">
                        {building.borough || '—'}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm font-medium">{building.properties.length || '—'} linked</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {propertyPreview.map((property) => (
                            <Badge key={property.id} variant="secondary" className="gap-1">
                              <Home className="h-3 w-3" />
                              <span className="truncate max-w-[140px]">{property.name}</span>
                            </Badge>
                          ))}
                          {extraProperties > 0 ? (
                            <Badge variant="outline">+{extraProperties} more</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-foreground">
                        {totalUnits ? (
                          <div className="space-y-1">
                            <div className="font-semibold">
                              {occupiedUnits}/{totalUnits} occupied
                            </div>
                            <div className="text-xs text-muted-foreground">{occupancyRate}% filled</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Units unavailable</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Buildings" description="All buildings linked to your properties." />
      <PageBody>
        <Stack gap="lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search buildings or properties"
                className="pl-9"
              />
            </div>
            <Select value={boroughFilter} onValueChange={setBoroughFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All boroughs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All boroughs</SelectItem>
                {boroughOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mainContent}
        </Stack>
      </PageBody>
    </PageShell>
  )
}
