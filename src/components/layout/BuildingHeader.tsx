'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, MapPin } from 'lucide-react';
import { Body, Heading, Label } from '@/ui/typography';

type BuildingShell = {
  id: string;
  streetAddress: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  borough: string | null;
  bbl: string | null;
  bin: string | null;
};

type Props = {
  buildingId: string;
};

export default function BuildingHeader({ buildingId }: Props) {
  const [building, setBuilding] = useState<BuildingShell | null>(null);
  const [loading, setLoading] = useState(true);
  const seg = useSelectedLayoutSegment() || 'summary';

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/buildings/${buildingId}`);
        if (!res.ok) throw new Error('Failed to load building');
        const data = await res.json();
        if (!isMounted) return;
        setBuilding({
          id: data.id,
          streetAddress: data.streetAddress,
          city: data.city || null,
          state: data.state || null,
          postalCode: data.postalCode || null,
          borough: data.borough || null,
          bbl: data.bbl || null,
          bin: data.bin || null,
        });
      } catch {
        if (isMounted) setBuilding(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [buildingId]);

  const tabs = [
    { key: 'summary', label: 'Summary', href: `/buildings/${buildingId}` },
    { key: 'compliance', label: 'Compliance', href: `/buildings/${buildingId}/compliance` },
  ];

  const title = building?.streetAddress || 'Building';
  const subtitle = [building?.city, building?.state, building?.postalCode].filter(Boolean).join(', ');

  return (
    <header className="space-y-3 p-6 pb-2">
      <Label as="div" size="xs" tone="muted" className="flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        Building profile
      </Label>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : (
        <>
          <Heading as="h1" size="h2" className="flex items-center gap-2">
            {title}
            {building?.borough ? <Badge variant="secondary">{building.borough}</Badge> : null}
            {building?.bin ? <Badge variant="outline">BIN {building.bin}</Badge> : null}
            {building?.bbl ? <Badge variant="outline">BBL {building.bbl}</Badge> : null}
          </Heading>
          <Body as="p" tone="muted" size="sm" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {subtitle || '—'}
          </Body>
        </>
      )}

      <div className="border-border mt-2 border-b">
        <nav className="flex space-x-8" aria-label="Building sections" role="navigation">
          {tabs.map((t) => {
            const isActive = seg === t.key;
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-current={isActive ? 'page' : undefined}
                className={`border-b-2 px-1 py-4 transition-colors ${isActive ? 'border-primary' : 'border-transparent hover:border-muted-foreground'}`}
              >
                <Label
                  as="span"
                  size="sm"
                  tone={isActive ? 'default' : 'muted'}
                  className={isActive ? undefined : 'transition-colors hover:text-foreground'}
                >
                  {t.label}
                </Label>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
