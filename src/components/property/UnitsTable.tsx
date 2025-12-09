'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
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
  property?: any;
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
    const cls =
      s === 'occupied'
        ? 'bg-[var(--color-action-50)] text-[var(--color-action-600)]'
        : 'bg-amber-100 text-amber-700';
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
      >
        {label}
      </span>
    );
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
    } catch (e: any) {
      setErr(e.message || 'Failed to create unit');
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
        <Table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Tenants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Most Recent Event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-card divide-y divide-[var(--color-border-subtle)]">
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
          <h3 className="mb-2 text-lg font-semibold">Add unit to {property?.name || 'property'}</h3>
          <div className="text-muted-foreground mb-4 text-sm">What is the unit information?</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs">Unit number</label>
              <Input
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. 10A"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">Market rent (optional)</label>
              <Input
                inputMode="decimal"
                value={marketRent}
                onChange={(e) => setMarketRent(e.target.value)}
                placeholder="$0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">Size (optional)</label>
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
              <label className="mb-1 block text-xs">Bedrooms</label>
              <Dropdown
                value={bedrooms}
                onChange={setBedrooms as any}
                options={BEDROOM_OPTIONS.map((v) => ({ value: v, label: v }))}
                placeholder="Select"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs">Bathrooms</label>
              <Dropdown
                value={bathrooms}
                onChange={setBathrooms as any}
                options={BATHROOM_OPTIONS.map((v) => ({ value: v, label: v }))}
                placeholder="Select"
              />
            </div>
          </div>

          <hr className="my-4" />
          <div className="text-muted-foreground mb-2 text-sm">What is the street address?</div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs">Street address</label>
              <Input value={address1} onChange={(e) => setAddress1(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs">City</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs">State</label>
                <Input value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs">ZIP</label>
                <Input value={postal} onChange={(e) => setPostal(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs">Country</label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs">Description</label>
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
