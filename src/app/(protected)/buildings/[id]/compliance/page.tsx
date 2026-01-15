'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Stack } from '@/components/layout/page-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import PropertyComplianceView from '@/app/(protected)/properties/[id]/compliance/ComplianceView';
import { Body, Label } from '@/ui/typography';

type BuildingProperty = {
  id: string;
  name: string;
  addressLine1: string | null;
};

type BuildingApiProperty = {
  id?: string;
  name?: string | null;
  addressLine1?: string | null;
  address_line1?: string | null;
};

type BuildingComplianceShell = {
  properties: BuildingProperty[];
};

export default function BuildingCompliancePage() {
  const params = useParams();
  const buildingId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shell, setShell] = useState<BuildingComplianceShell | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/buildings/${buildingId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load building');
        }
        const data = (await res.json()) as { properties?: BuildingApiProperty[] };
        const properties: BuildingProperty[] = (data.properties || [])
          .filter((p): p is BuildingApiProperty & { id: string } => Boolean(p?.id))
          .map((p) => ({
            id: String(p.id),
            name: p.name ?? '',
            addressLine1: p.addressLine1 ?? p.address_line1 ?? '',
          }));
        setShell({ properties });
        setSelectedPropertyId((current) => current ?? (properties[0]?.id ?? null));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load building');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [buildingId]);

  const propertyOptions = useMemo(
    () => shell?.properties || [],
    [shell?.properties],
  );

  if (loading) {
    return (
      <Body as="div" size="sm" tone="muted" className="flex items-center gap-2 py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading compliance...
      </Body>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Body as="p" size="sm" className="text-destructive">
            Failed to load building compliance: {error}
          </Body>
        </CardContent>
      </Card>
    );
  }

  if (!propertyOptions.length) {
    return (
      <Card>
        <CardContent className="py-6">
          <Body tone="muted" size="sm">
            No linked properties found for this building. Add a property to view compliance.
          </Body>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {propertyOptions.length > 1 ? (
        <div className="flex items-center gap-3">
          <Label size="sm">Select property</Label>
          <Select
            value={selectedPropertyId || undefined}
            onValueChange={(value) => setSelectedPropertyId(value)}
          >
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Choose property" />
            </SelectTrigger>
            <SelectContent>
              {propertyOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name || p.addressLine1 || 'Property'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setSelectedPropertyId(propertyOptions[0]?.id || null)}>
            Reset
          </Button>
        </div>
      ) : null}

      {selectedPropertyId ? (
        <PropertyComplianceView propertyIdOverride={selectedPropertyId} />
      ) : (
        <Card>
          <CardContent className="py-6">
            <Body tone="muted" size="sm">
              Select a property to view compliance.
            </Body>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
