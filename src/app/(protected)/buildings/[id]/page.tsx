'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, BadgeAlert, Building2, Home, Loader2, MapPin, RefreshCw } from 'lucide-react'

import { PageBody, PageColumns, PageGrid, PageHeader, PageShell, Stack } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type BuildingDetail = {
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
  createdAt?: string | null
  updatedAt?: string | null
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
    postalCode: string | null
    totalUnits: number
    occupiedUnits: number
    vacantUnits: number
  }>
}

const OCCUPANCY_GROUPS = ['R-1', 'R-2', 'R-3', 'Mixed', 'Other']
const UNSET = 'unset'

export default function BuildingDetailsPage() {
  const params = useParams()
  const buildingId = params.id as string
  const [building, setBuilding] = useState<BuildingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buildingDraft, setBuildingDraft] = useState<{
    occupancy_group: string
    occupancy_description: string
    is_one_two_family: boolean
    is_private_residence_building: boolean
    dwelling_unit_count: number | null
  } | null>(null)
  const [savingBuilding, setSavingBuilding] = useState(false)

  const fetchBuilding = useCallback(async () => {
    if (!buildingId) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/buildings/${buildingId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to load building')
      }
      const data = (await res.json()) as BuildingDetail
      setBuilding(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load building')
    } finally {
      setLoading(false)
    }
  }, [buildingId])

  useEffect(() => {
    void fetchBuilding()
  }, [fetchBuilding])

  useEffect(() => {
    if (building) {
      setBuildingDraft({
        occupancy_group: building.occupancyGroup || '',
        occupancy_description: building.occupancyDescription || '',
        is_one_two_family: Boolean(building.isOneTwoFamily),
        is_private_residence_building: Boolean(building.isPrivateResidenceBuilding),
        dwelling_unit_count: building.dwellingUnitCount ?? null,
      })
    } else {
      setBuildingDraft(null)
    }
  }, [building])

  const locationLabel = useMemo(() => {
    if (!building) return ''
    const parts = [building.city, building.state, building.postalCode].filter(Boolean)
    return parts.join(', ')
  }, [building])

  const mapHref = useMemo(() => {
    if (!building) return null
    if (building.latitude && building.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${building.latitude},${building.longitude}`
    }
    const query = [building.streetAddress, building.city, building.state, building.postalCode]
      .filter(Boolean)
      .join(' ')
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null
  }, [building])

  const propertyCount = building?.properties.length ?? 0
  const totalUnits = building?.totalUnits || building?.dwellingUnitCount || 0

  const saveBuilding = async () => {
    if (!building?.id || !buildingDraft) return
    try {
      setSavingBuilding(true)
      const res = await fetch(`/api/buildings/${building.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occupancy_group: buildingDraft.occupancy_group || null,
          occupancy_description: buildingDraft.occupancy_description || null,
          is_one_two_family: buildingDraft.is_one_two_family,
          is_private_residence_building: buildingDraft.is_private_residence_building,
          dwelling_unit_count: buildingDraft.dwelling_unit_count,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to update building')
      const updated = body.building
      setBuilding((prev) =>
        prev
          ? {
              ...prev,
              occupancyGroup: updated?.occupancy_group ?? prev.occupancyGroup,
              occupancyDescription: updated?.occupancy_description ?? prev.occupancyDescription,
              isOneTwoFamily:
                typeof updated?.is_one_two_family === 'boolean' ? updated.is_one_two_family : prev.isOneTwoFamily,
              isPrivateResidenceBuilding:
                typeof updated?.is_private_residence_building === 'boolean'
                  ? updated.is_private_residence_building
                  : prev.isPrivateResidenceBuilding,
              dwellingUnitCount:
                typeof updated?.dwelling_unit_count === 'number' ? updated.dwelling_unit_count : prev.dwellingUnitCount,
            }
          : prev,
      )
      if (updated) {
        setBuildingDraft({
          occupancy_group: updated.occupancy_group || '',
          occupancy_description: updated.occupancy_description || '',
          is_one_two_family: Boolean(updated.is_one_two_family),
          is_private_residence_building: Boolean(updated.is_private_residence_building),
          dwelling_unit_count: updated.dwelling_unit_count ?? null,
        })
      }
      toast.success('Building applicability updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update building')
    } finally {
      setSavingBuilding(false)
    }
  }

  const renderStats = () => {
    if (!building) return null
    return (
      <PageGrid columns={4}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totalUnits || '—'}</div>
            <p className="text-sm text-muted-foreground">
              {building.occupiedUnits} occupied · {building.vacantUnits} vacant
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Occupancy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold">{building.occupancyRate}%</div>
            <Progress value={building.occupancyRate} />
            <p className="text-sm text-muted-foreground">Portfolio rollup for linked properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{propertyCount}</div>
            <p className="text-sm text-muted-foreground">connected to this building</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Occupancy group</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {building.occupancyGroup || 'Unset'}
            </div>
            <p className="text-sm text-muted-foreground">
              {building.occupancyDescription || 'No description on file'}
            </p>
          </CardContent>
        </Card>
      </PageGrid>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title={building?.streetAddress || 'Building'}
        description={locationLabel || 'Location pending'}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/buildings">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Buildings
              </Link>
            </Button>
            {mapHref ? (
              <Button variant="secondary" size="sm" asChild>
                <a href={mapHref} target="_blank" rel="noreferrer">
                  <MapPin className="h-4 w-4 mr-2" />
                  Open in Maps
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void fetchBuilding()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      >
        {building?.borough || building?.ntaName ? (
          <div className="flex flex-wrap gap-2">
            {building.borough ? <Badge variant="secondary">{building.borough}</Badge> : null}
            {building.ntaName ? <Badge variant="outline">NTA {building.ntaName}</Badge> : null}
            {building.neighborhood ? <Badge variant="outline">{building.neighborhood}</Badge> : null}
          </div>
        ) : null}
      </PageHeader>

      <PageBody>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <PageGrid columns={4}>
              {[...Array(4)].map((_, idx) => (
                <Card key={idx}>
                  <CardContent className="space-y-3 pt-6">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </PageGrid>
            <Card>
              <CardContent className="space-y-3 pt-6">
                {[...Array(3)].map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : !building ? (
          <div className="rounded-lg border border-muted/70 p-6 text-sm text-muted-foreground">
            Building not found.
          </div>
        ) : (
          <Stack gap="lg">
            <Card>
              <CardHeader>
                <CardTitle>Building applicability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="occupancy_group">Occupancy Group</Label>
                    <Select
                      value={buildingDraft?.occupancy_group || UNSET}
                      onValueChange={(val) =>
                        setBuildingDraft((prev) => (prev ? { ...prev, occupancy_group: val === UNSET ? '' : val } : prev))
                      }
                      disabled={!buildingDraft}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET}>Unset</SelectItem>
                        {OCCUPANCY_GROUPS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dwelling_unit_count">Dwelling units</Label>
                    <Input
                      id="dwelling_unit_count"
                      type="number"
                      value={buildingDraft?.dwelling_unit_count ?? ''}
                      onChange={(e) =>
                        setBuildingDraft((prev) =>
                          prev ? { ...prev, dwelling_unit_count: e.target.value ? Number(e.target.value) : null } : prev,
                        )
                      }
                      placeholder="e.g. 12"
                      disabled={!buildingDraft}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupancy_description">Occupancy description</Label>
                    <Input
                      id="occupancy_description"
                      value={buildingDraft?.occupancy_description || ''}
                      onChange={(e) =>
                        setBuildingDraft((prev) => (prev ? { ...prev, occupancy_description: e.target.value } : prev))
                      }
                      placeholder="e.g. R-2 multifamily with retail"
                      disabled={!buildingDraft}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_one_two_family"
                      checked={buildingDraft?.is_one_two_family || false}
                      onCheckedChange={(checked) =>
                        setBuildingDraft((prev) => (prev ? { ...prev, is_one_two_family: Boolean(checked) } : prev))
                      }
                      disabled={!buildingDraft}
                    />
                    <Label htmlFor="is_one_two_family">1–2 family</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_private_residence_building"
                      checked={buildingDraft?.is_private_residence_building || false}
                      onCheckedChange={(checked) =>
                        setBuildingDraft((prev) =>
                          prev ? { ...prev, is_private_residence_building: Boolean(checked) } : prev,
                        )
                      }
                      disabled={!buildingDraft}
                    />
                    <Label htmlFor="is_private_residence_building">Private residence</Label>
                  </div>
                  <Button onClick={saveBuilding} disabled={savingBuilding || !buildingDraft}>
                    {savingBuilding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save building
                  </Button>
                </div>
              </CardContent>
            </Card>

            {renderStats()}

            <PageColumns
              primary={
                <Stack gap="lg">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5" />
                        Properties in this building
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {building.properties.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No properties linked yet.</div>
                      ) : (
                        building.properties.map((property) => (
                          <div
                            key={property.id}
                            className="flex flex-col gap-1 rounded-lg border border-muted/70 bg-card px-3 py-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <Link
                                href={`/properties/${property.id}/summary`}
                                className="font-medium hover:text-primary"
                              >
                                {property.name}
                              </Link>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>
                                  {property.addressLine1 || 'Address pending'}
                                  {property.city ? `, ${property.city}` : ''}
                                  {property.state ? ` ${property.state}` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="capitalize">
                                {property.status || 'Unknown'}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {property.occupiedUnits}/{property.totalUnits || '—'} occupied
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </Stack>
              }
              secondary={
                <Stack gap="lg">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Building profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Borough</span>
                        <span className="font-medium">{building.borough || 'Not set'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Neighborhood</span>
                        <span className="font-medium">{building.neighborhood || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">One / Two family</span>
                        <span className="font-medium">{building.isOneTwoFamily ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Private residence</span>
                        <span className="font-medium">
                          {building.isPrivateResidenceBuilding ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Dwelling units</span>
                        <span className="font-medium">{building.dwellingUnitCount ?? '—'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BadgeAlert className="h-5 w-5" />
                        Reference numbers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">BBL</span>
                        <span className="font-medium">{building.bbl || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">BIN</span>
                        <span className="font-medium">{building.bin || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">PARID</span>
                        <span className="font-medium">{building.parid || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">NTA</span>
                        <span className="font-medium">{building.ntaName || '—'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Stack>
              }
            />
          </Stack>
        )}
      </PageBody>
    </PageShell>
  )
}
