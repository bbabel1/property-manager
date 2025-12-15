'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Stack } from '@/components/layout/page-shell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import PropertyCompliancePage from '@/app/(protected)/properties/[id]/compliance/page';

type BuildingProperty = {
  id: string;
  name: string;
  addressLine1: string | null;
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
        const data = await res.json();
        const properties: BuildingProperty[] = (data.properties || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          addressLine1: p.addressLine1 || p.address_line1 || '',
        }));
        setShell({ properties });
        if (properties.length && !selectedPropertyId) {
          setSelectedPropertyId(properties[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load building');
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  const propertyOptions = useMemo(
    () => shell?.properties || [],
    [shell?.properties],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading compliance...
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-destructive py-6">Failed to load building compliance: {error}</CardContent>
      </Card>
    );
  }

  if (!propertyOptions.length) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6">
          No linked properties found for this building. Add a property to view compliance.
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {propertyOptions.length > 1 ? (
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">Select property</div>
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
        <PropertyCompliancePage propertyIdOverride={selectedPropertyId} />
      ) : (
        <Card>
          <CardContent className="py-6 text-muted-foreground">Select a property to view compliance.</CardContent>
        </Card>
      )}
    </Stack>
  );
}
