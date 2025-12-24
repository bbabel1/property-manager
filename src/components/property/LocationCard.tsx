'use client';

import { useEffect, useState } from 'react';
import InlineEditCard from '@/components/form/InlineEditCard';
import EditLink from '@/components/ui/EditLink';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';

type LocationProperty = {
  id: string;
  name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  status?: string | null;
  property_type?: string | null;
  reserve?: number | null;
  year_built?: number | null;
  borough?: string | null;
  neighborhood?: string | null;
  longitude?: number | string | null;
  latitude?: number | string | null;
  location_verified?: boolean | null;
};

export default function LocationCard({ property }: { property: LocationProperty }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const [borough, setBorough] = useState<string>(property.borough || '');
  const [neighborhood, setNeighborhood] = useState<string>(property.neighborhood || '');
  const [longitude, setLongitude] = useState<string>(() =>
    property.longitude != null ? String(property.longitude) : '',
  );
  const [latitude, setLatitude] = useState<string>(() =>
    property.latitude != null ? String(property.latitude) : '',
  );
  const [verified, setVerified] = useState<boolean>(!!property.location_verified);
  const sectionLabelClass = 'eyebrow-label';

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' });
        const j = (await res.json().catch(() => ({}))) as { token?: string };
        if (!cancelled) setCsrfToken(j?.token || null);
      } catch {
        if (!cancelled) setCsrfToken(null);
      }
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);
      if (!csrfToken) throw new Error('CSRF token not found');
      const body = {
        // Required by API
        name: property.name,
        address_line1: property.address_line1,
        address_line2: property.address_line2 || null,
        address_line3: property.address_line3 || null,
        city: property.city,
        state: property.state,
        postal_code: property.postal_code,
        country: property.country || 'United States',
        status: property.status || 'Active',
        property_type: property.property_type ?? null,
        reserve: property.reserve ?? 0,
        year_built: property.year_built ?? null,
        // Location fields
        borough: borough || null,
        neighborhood: neighborhood || null,
        longitude: longitude === '' ? null : Number(longitude),
        latitude: latitude === '' ? null : Number(latitude),
        location_verified: !!verified,
      };
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j?.error || 'Failed to update location');
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update location');
    } finally {
      setSaving(false);
    }
  }

  const view = (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className={sectionLabelClass}>Borough</p>
          <p className="text-foreground mt-1 text-sm font-medium">{borough || '—'}</p>
        </div>
        <div>
          <p className={sectionLabelClass}>Neighborhood</p>
          <p className="text-foreground mt-1 text-sm font-medium">{neighborhood || '—'}</p>
        </div>
        <div>
          <p className={sectionLabelClass}>Longitude</p>
          <p className="text-foreground mt-1 text-sm font-medium">
            {longitude !== '' ? longitude : '—'}
          </p>
        </div>
        <div>
          <p className={sectionLabelClass}>Latitude</p>
          <p className="text-foreground mt-1 text-sm font-medium">
            {latitude !== '' ? latitude : '—'}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <p className={sectionLabelClass}>Location Verified</p>
        <div className="mt-1 flex items-center gap-2">
          {verified ? (
            <>
              <CheckCircle2 className="text-primary h-4 w-4" aria-hidden="true" />
              <span className="text-primary text-sm font-medium">Verified</span>
            </>
          ) : (
            <>
              <XCircle className="text-muted-foreground h-4 w-4" aria-hidden="true" />
              <span className="text-muted-foreground text-sm font-medium">Not verified</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const edit = (
    <div className="surface-card relative p-6 text-sm transition-colors">
      <div className="bg-primary absolute top-2 bottom-2 left-0 w-0.5 rounded-r-sm" />
      <button
        type="button"
        aria-label="Close"
        onClick={() => setEditing(false)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-offset-background absolute top-3 right-3 rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div className="space-y-6">
        {/* Location Information */}
        <div>
          <h4 className="text-foreground mb-2 text-sm font-medium">Location Information</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-muted-foreground mb-1 block text-sm font-medium">
                Borough
              </label>
              <input
                type="text"
                value={borough}
                onChange={(e) => setBorough(e.target.value)}
                className="border-border bg-background text-foreground focus-visible:ring-offset-background h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                placeholder="e.g., Manhattan"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-sm font-medium">
                Neighborhood
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="border-border bg-background text-foreground focus-visible:ring-offset-background h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                placeholder="e.g., Upper West Side"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-sm font-medium">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="border-border bg-background text-foreground focus-visible:ring-offset-background h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                placeholder="e.g., -73.9857"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-sm font-medium">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="border-border bg-background text-foreground focus-visible:ring-offset-background h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                placeholder="e.g., 40.7484"
              />
            </div>
          </div>
        </div>

        {/* Verification */}
        <div>
          <h4 className="text-foreground mb-2 text-sm font-medium">Verification</h4>
          <div className="flex items-center gap-2">
            <input
              id="verified"
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="border-border accent-primary h-4 w-4 rounded"
            />
            <label htmlFor="verified" className="text-foreground text-sm">
              Location Verified
            </label>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <Button onClick={onSave} disabled={saving} className="min-h-[2.75rem]">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="cancel" onClick={() => setEditing(false)} className="min-h-[2.75rem]">
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="section-title-row">
        <h2 className="section-title-text">Location</h2>
        {!editing && <EditLink onClick={() => setEditing(true)} />}
      </div>
      <InlineEditCard
        title=""
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => {
          setEditing(false);
          setError(null);
        }}
        onSave={onSave}
        isSaving={saving}
        canSave={true}
        variant="plain"
        className="surface-card"
        view={view}
        edit={edit}
        titleHidden={true}
        headerHidden={true}
      />
    </>
  );
}
