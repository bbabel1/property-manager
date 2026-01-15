'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
  type BedroomEnum,
  type BathroomEnum,
} from '@/types/units';
import { Body, Heading, Label } from '@/ui/typography';

type Unit = {
  id: string;
  unit_number?: string | null;
  status?: string | null;
  tenants?: Array<{ name?: string | null; is_active?: boolean | null }>;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function UnitsTable({
  propertyId,
  property,
  initialUnits,
}: {
  propertyId: string;
  property?: {
    name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    address_line3?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  initialUnits: Unit[];
}) {
  const [units, setUnits] = useState<Unit[]>(initialUnits || []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  // Form state
  const [unitNumber, setUnitNumber] = useState('');
  const [marketRent, setMarketRent] = useState<string>('');
  const [unitSize, setUnitSize] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<BedroomEnum | ''>('');
  const [bathrooms, setBathrooms] = useState<BathroomEnum | ''>('');
  const [address1, setAddress1] = useState<string>('');
  const [address2, setAddress2] = useState<string>('');
  const [address3, setAddress3] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [postal, setPostal] = useState<string>('');
  const [country, setCountry] = useState<string>('United States');
  const [description, setDescription] = useState<string>('');

  // Reload units after adding
  const reload = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/details`, { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      const list = Array.isArray(j?.units) ? j.units : [];
      setUnits(list);
    } catch {}
  };

  const mostRecentEvent = (u: Unit) => {
    const ts = u.updated_at || u.created_at;
    if (!ts) return '—';
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    return `Updated ${date.toLocaleDateString()}`;
  };

  const statusBadge = (status?: string | null) => {
    const s = String(status || '').toLowerCase();
    if (!s) return null;
    const variant = s === 'occupied' ? 'success' : 'warning';
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    return <Badge variant={variant} className="status-pill px-2.5 py-0.5">{label}</Badge>;
  };

  const tenantLabel = (u: Unit) => {
    const active = (u.tenants || []).filter((t) => t?.is_active !== false);
    if (active.length === 0) return ''; // blank when no active tenants
    const names = active
      .map((t) => t?.name)
      .filter(Boolean)
      .join(', ');
    return names || '';
  };

  // Prefill address when opening form
  const beginAdd = () => {
    setErr(null);
    setUnitNumber('');
    setMarketRent('');
    setUnitSize('');
    setBedrooms('');
    setBathrooms('');
    setAddress1(property?.address_line1 || '');
    setAddress2(property?.address_line2 || '');
    setAddress3(property?.address_line3 || '');
    setCity(property?.city || '');
    setState(property?.state || '');
    setPostal(property?.postal_code || '');
    setCountry(property?.country || 'United States');
    setDescription('');
    setOpen(true);
  };

  const save = async () => {
    try {
      setSaving(true);
      setErr(null);
      if (!unitNumber.trim()) throw new Error('Unit number is required');
      const body = {
        propertyId,
        unitNumber: unitNumber.trim(),
        unitSize: unitSize ? Number(unitSize) : undefined,
        marketRent: marketRent ? Number(marketRent) : undefined,
        addressLine1: address1,
        addressLine2: address2 || undefined,
        addressLine3: address3 || undefined,
        city,
        state,
        postalCode: postal,
        country,
        unitBedrooms: bedrooms || undefined,
        unitBathrooms: bathrooms || undefined,
        description: description || undefined,
      };
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Failed to create unit');
      setOpen(false);
      await reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create unit';
      setErr(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!open && (
        <div className="mb-2 flex items-center justify-end">
          <Button size="sm" onClick={beginAdd}>
            + Add unit
          </Button>
        </div>
      )}
      {!open && (
        <Table className="min-w-full divide-y divide-border-subtle">
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Tenants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Most Recent Event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-card divide-y divide-border-subtle">
            {units.map((u) => {
              const unitHref = `/properties/${propertyId}/units/${u.id}`;
              const unitLabel = u.unit_number || '—';
              const goToUnit = () => router.push(unitHref);
              const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                  event.preventDefault();
                  goToUnit();
                }
              };

              return (
                <TableRow
                  key={u.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`View details for unit ${unitLabel}`}
                  onClick={goToUnit}
                  onKeyDown={handleRowKeyDown}
                  className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  <TableCell className="text-primary">{unitLabel}</TableCell>
                  <TableCell>{tenantLabel(u)}</TableCell>
                  <TableCell>
                    {statusBadge(u.status) || (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {mostRecentEvent(u)}
                  </TableCell>
                </TableRow>
              );
            })}
            {units.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-sm">
                  No units
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {open && (
        <div className="bg-card rounded-md border p-4">
          <Heading as="h3" size="h5" className="mb-2">
            Add unit to {property?.name || 'property'}
          </Heading>
          <Body tone="muted" size="sm" className="mb-4">
            What is the unit information?
          </Body>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label size="xs" className="mb-1 block">
                Unit number
              </Label>
              <Input
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 10A"
              />
            </div>
            <div>
              <Label size="xs" className="mb-1 block">
                Market rent (optional)
              </Label>
              <Input
                inputMode="decimal"
                value={marketRent}
                onChange={(e) => setMarketRent(e.target.value)}
                placeholder="$0.00"
              />
            </div>
            <div>
              <Label size="xs" className="mb-1 block">
                Size (optional)
              </Label>
              <Input
                inputMode="numeric"
                value={unitSize}
                onChange={(e) => setUnitSize(e.target.value)}
                placeholder="sq. ft."
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label size="xs" className="mb-1 block">
                Bedrooms
              </Label>
              <Dropdown
                value={bedrooms}
                onChange={(value) => setBedrooms(value as BedroomEnum | '')}
                options={BEDROOM_OPTIONS.map((v) => ({ value: v, label: v }))}
                placeholder="Select"
              />
            </div>
            <div>
              <Label size="xs" className="mb-1 block">
                Bathrooms
              </Label>
              <Dropdown
                value={bathrooms}
                onChange={(value) => setBathrooms(value as BathroomEnum | '')}
                options={BATHROOM_OPTIONS.map((v) => ({ value: v, label: v }))}
                placeholder="Select"
              />
            </div>
          </div>

          <hr className="my-4" />
          <Body tone="muted" size="sm" className="mb-2">
            What is the street address?
          </Body>
          <div className="space-y-3">
            <div>
              <Label size="xs" className="mb-1 block">
                Street address
              </Label>
              <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label size="xs" className="mb-1 block">
                  City
                </Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label size="xs" className="mb-1 block">
                  State
                </Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <Label size="xs" className="mb-1 block">
                  ZIP
                </Label>
                <Input value={postal} onChange={(e) => setPostal(e.target.value)} />
              </div>
            </div>
            <div>
              <Label size="xs" className="mb-1 block">
                Country
              </Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <Label size="xs" className="mb-1 block">
                Description
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {err && <div className="text-destructive mt-3 text-sm">{err}</div>}
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save unit'}
            </Button>
            <Button variant="cancel" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
