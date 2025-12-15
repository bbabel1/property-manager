'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, BadgeAlert, Building2, Home, Loader2, MapPin, RefreshCw } from 'lucide-react';

import { PageColumns, PageGrid, Stack } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

type BuildingDetail = {
  id: string;
  streetAddress: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  borough: string | null;
  neighborhood: string | null;
  ntaName: string | null;
  bbl: string | null;
  bin: string | null;
  parid: string | null;
  latitude: number | null;
  longitude: number | null;
  occupancyGroup: string | null;
  occupancyDescription: string | null;
  isOneTwoFamily: boolean | null;
  isPrivateResidenceBuilding: boolean | null;
  residentialUnits: number | null;
  dwellingUnitCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  properties: Array<{
    id: string;
    name: string;
    status: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
  }>;
};

const OCCUPANCY_GROUPS = ['R-1', 'R-2', 'R-3', 'Mixed', 'Other'];
const UNSET = 'unset';

export default function BuildingSummaryPage() {
  const params = useParams();
  const buildingId = params.id as string;
  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildingDraft, setBuildingDraft] = useState<{
    occupancy_group: string;
    occupancy_description: string;
    is_one_two_family: boolean;
    is_private_residence_building: boolean;
    residential_units: number | null;
  } | null>(null);
  const [savingBuilding, setSavingBuilding] = useState(false);

  const fetchBuilding = useCallback(async () => {
    if (!buildingId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/buildings/${buildingId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load building');
      }
      const data = (await res.json()) as BuildingDetail;
      setBuilding(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load building');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void fetchBuilding();
  }, [fetchBuilding]);

  useEffect(() => {
    if (building) {
      setBuildingDraft({
        occupancy_group: building.occupancyGroup || '',
        occupancy_description: building.occupancyDescription || '',
        is_one_two_family: Boolean(building.isOneTwoFamily),
        is_private_residence_building: Boolean(building.isPrivateResidenceBuilding),
        residential_units: building.residentialUnits ?? null,
      });
    } else {
      setBuildingDraft(null);
    }
  }, [building]);

  const locationLabel = useMemo(() => {
    if (!building) return '';
    const parts = [building.city, building.state, building.postalCode].filter(Boolean);
    return parts.join(', ');
  }, [building]);

  const mapHref = useMemo(() => {
    if (!building) return null;
    if (building.latitude && building.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${building.latitude},${building.longitude}`;
    }
    const query = [building.streetAddress, building.city, building.state, building.postalCode]
      .filter(Boolean)
      .join(' ');
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : null;
  }, [building]);

  const propertyCount = building?.properties.length ?? 0;
  const totalUnits = building?.totalUnits || building?.dwellingUnitCount || 0;

  const saveBuilding = async () => {
    if (!building?.id || !buildingDraft) return;
    try {
      setSavingBuilding(true);
      const res = await fetch(`/api/buildings/${building.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occupancy_group: buildingDraft.occupancy_group || null,
          occupancy_description: buildingDraft.occupancy_description || null,
          is_one_two_family: buildingDraft.is_one_two_family,
          is_private_residence_building: buildingDraft.is_private_residence_building,
          residential_units: buildingDraft.residential_units,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to update building');
      const updated = body.building;
      setBuilding((prev) =>
        prev
          ? {
              ...prev,
              occupancyGroup: updated?.occupancy_group ?? prev.occupancyGroup,
              occupancyDescription: updated?.occupancy_description ?? prev.occupancyDescription,
              isOneTwoFamily:
                typeof updated?.is_one_two_family === 'boolean'
                  ? updated.is_one_two_family
                  : prev.isOneTwoFamily,
              isPrivateResidenceBuilding:
                typeof updated?.is_private_residence_building === 'boolean'
                  ? updated.is_private_residence_building
                  : prev.isPrivateResidenceBuilding,
              residentialUnits:
                typeof updated?.residential_units === 'number'
                  ? updated.residential_units
                  : prev.residentialUnits,
            }
          : prev,
      );
      if (updated) {
        setBuildingDraft({
          occupancy_group: updated.occupancy_group || '',
          occupancy_description: updated.occupancy_description || '',
          is_one_two_family: Boolean(updated.is_one_two_family),
          is_private_residence_building: Boolean(updated.is_private_residence_building),
          residential_units: updated.residential_units ?? null,
        });
      }
      toast.success('Building applicability updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update building');
    } finally {
      setSavingBuilding(false);
    }
  };

  const renderStats = () => {
    if (!building) return null;
    return (
      <PageGrid columns={4}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totalUnits || '—'}</div>
            <p className="text-muted-foreground text-sm">
              {building.occupiedUnits} occupied · {building.vacantUnits} vacant
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Occupancy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold">{building.occupancyRate}%</div>
            <Progress value={building.occupancyRate} />
            <p className="text-muted-foreground text-sm">Portfolio rollup for linked properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{propertyCount}</div>
            <p className="text-muted-foreground text-sm">connected to this building</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Compliance signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Use the Compliance tab to view registrations, assets, and items for linked properties.
            </p>
          </CardContent>
        </Card>
      </PageGrid>
    );
  };

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/buildings" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to buildings
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {building?.bin ? <Badge variant="outline">BIN {building.bin}</Badge> : null}
          {building?.bbl ? <Badge variant="outline">BBL {building.bbl}</Badge> : null}
          {building?.parid ? <Badge variant="outline">PARID {building.parid}</Badge> : null}
          <Button variant="secondary" size="sm" onClick={() => void fetchBuilding()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <PageGrid columns={4}>
            {[...Array(4)].map((_, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </PageGrid>
        </Card>
      ) : error ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3 text-destructive">
            <BadgeAlert className="h-5 w-5" />
            <div>
              <p className="font-semibold">Failed to load building</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void fetchBuilding()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : !building ? (
        <Card className="space-y-4 p-6">
          <div className="text-muted-foreground">Building not found.</div>
        </Card>
      ) : (
        <Stack gap="lg">
          <Card>
            <CardContent className="space-y-1 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="flex items-center gap-2 text-2xl font-bold">
                    <Building2 className="h-6 w-6 text-primary" />
                    {building.streetAddress}
                  </h1>
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    {locationLabel || 'Location unavailable'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {building.latitude && building.longitude ? (
                      <span>
                        Lat {building.latitude}, Lng {building.longitude}
                      </span>
                    ) : null}
                    {mapHref ? (
                      <Link href={mapHref} target="_blank" className="text-primary hover:underline">
                        View on map
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {building.borough ? <Badge variant="secondary">{building.borough}</Badge> : null}
                    {building.neighborhood ? <Badge variant="outline">{building.neighborhood}</Badge> : null}
                    {building.ntaName ? <Badge variant="outline">{building.ntaName}</Badge> : null}
                  </div>
                </div>
                <div className="min-w-[260px] space-y-3 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">BBL</span>
                    <span className="font-semibold">{building.bbl || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">BIN</span>
                    <span className="font-semibold">{building.bin || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">PARID</span>
                    <span className="font-semibold">{building.parid || '—'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {renderStats()}

          <Stack gap="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Occupancy & applicability</h2>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => void fetchBuilding()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh data
                </Button>
                <Button size="sm" onClick={saveBuilding} disabled={savingBuilding}>
                  {savingBuilding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
            <PageColumns
              primary={
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-muted-foreground text-sm font-medium">Occupancy group</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Select
                        value={buildingDraft?.occupancy_group || UNSET}
                        onValueChange={(val) =>
                          setBuildingDraft((prev) =>
                            prev ? { ...prev, occupancy_group: val === UNSET ? '' : val } : prev,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET}>Unset</SelectItem>
                          {OCCUPANCY_GROUPS.map((og) => (
                            <SelectItem key={og} value={og}>
                              {og}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">
                        Set the primary occupancy for applicability rules (e.g., R-2 multi-family).
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-muted-foreground text-sm font-medium">
                        Occupancy description
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        value={buildingDraft?.occupancy_description || ''}
                        onChange={(e) =>
                          setBuildingDraft((prev) =>
                            prev ? { ...prev, occupancy_description: e.target.value } : prev,
                          )
                        }
                        placeholder="e.g., Res.: Apartments, 4 Stories"
                      />
                      <p className="text-muted-foreground text-xs">Short freeform descriptor from PLUTO/assessor.</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-muted-foreground text-sm font-medium">Residential units</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Input
                        type="number"
                        min={0}
                        value={buildingDraft?.residential_units ?? ''}
                        onChange={(e) =>
                          setBuildingDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  residential_units: e.target.value === '' ? null : Number(e.target.value),
                                }
                              : prev,
                          )
                        }
                        placeholder="Units"
                      />
                      <p className="text-muted-foreground text-xs">
                        Used for HPD registration applicability and other programs.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-muted-foreground text-sm font-medium">Flags</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="font-medium">1–2 Family</div>
                          <p className="text-muted-foreground text-sm">
                            Marked as one/two-family (PLUTO indicator).
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(buildingDraft?.is_one_two_family)}
                          onCheckedChange={(checked) =>
                            setBuildingDraft((prev) =>
                              prev ? { ...prev, is_one_two_family: checked } : prev,
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="font-medium">Private residence building</div>
                          <p className="text-muted-foreground text-sm">
                            Whether this is flagged as a private residence (for applicability).
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(buildingDraft?.is_private_residence_building)}
                          onCheckedChange={(checked) =>
                            setBuildingDraft((prev) =>
                              prev ? { ...prev, is_private_residence_building: checked } : prev,
                            )
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                </>
              }
            />
          </Stack>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Linked properties</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/70 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Property</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Units</th>
                      <th className="px-6 py-3 font-semibold">Occupied</th>
                      <th className="px-6 py-3 font-semibold">Vacant</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card">
                    {building.properties.map((property) => (
                      <tr
                        key={property.id}
                        className="border-b border-border/80 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-6 py-4 align-top">
                          <Stack gap="xs">
                            <Link
                              href={`/properties/${property.id}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              {property.name}
                            </Link>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Home className="h-3 w-3" />
                              <span className="truncate">
                                {[property.addressLine1, property.city, property.state]
                                  .filter(Boolean)
                                  .join(', ') || '—'}
                              </span>
                            </div>
                          </Stack>
                        </td>
                        <td className="px-6 py-4 align-top text-sm text-foreground">
                          {property.status || '—'}
                        </td>
                        <td className="px-6 py-4 align-top">{property.totalUnits ?? '—'}</td>
                        <td className="px-6 py-4 align-top">{property.occupiedUnits ?? '—'}</td>
                        <td className="px-6 py-4 align-top">{property.vacantUnits ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
