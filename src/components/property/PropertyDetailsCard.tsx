'use client';

import { useEffect, useMemo, useState, Fragment, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import InlineEditCard from '@/components/form/InlineEditCard';
import EditLink from '@/components/ui/EditLink';
import RepeaterField from '@/components/form/fields/RepeaterField';

type OwnerOption = { id: string; name: string };
type OwnerRow = {
  id: string;
  ownerId: string;
  name: string;
  ownershipPercentage: number;
  disbursementPercentage: number;
  primary?: boolean;
};

interface Property {
  id: string;
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  status?: string;
  property_type?: string;
  reserve?: number;
  year_built?: number;
  property_manager_id?: string;
  property_manager_name?: string;
  buildium_property_id?: string;
  primary_image_url?: string;
  owners?: Owner[];
}

interface Owner {
  id?: string;
  owner_id?: string;
  display_name?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  ownership_percentage?: number;
  disbursement_percentage?: number;
  primary?: boolean;
}

interface StaffMember {
  id: string;
  displayName?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

interface OwnerAPIResponse {
  id: string;
  displayName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export default function PropertyDetailsCard({ property }: { property: Property }) {
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  // Use server-provided image first; client fetch only if missing
  const initialUrl = property?.primary_image_url || null;
  const [address1, setAddress1] = useState(property.address_line1 || '');
  const [city, setCity] = useState(property.city || '');
  const [state, setState] = useState(property.state || '');
  const [postal, setPostal] = useState(property.postal_code || '');
  const [owners, setOwners] = useState<OwnerRow[]>(() =>
    (property.owners || []).map((o: Owner) => ({
      id: String(o.owner_id || o.id || crypto.randomUUID()),
      ownerId: String(o.owner_id || o.id || ''),
      name:
        o.display_name ||
        o.company_name ||
        `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() ||
        'Owner',
      ownershipPercentage: Number(o.ownership_percentage ?? 0),
      disbursementPercentage: Number(o.disbursement_percentage ?? 0),
      primary: Boolean(o.primary),
    })),
  );
  const [managerId, setManagerId] = useState<string>('');
  const [managerOptions, setManagerOptions] = useState<
    { id: string; name: string; role?: string }[]
  >([]);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [_loadingOwners, setLoadingOwners] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Inline create-new-owner state (mirrors New Property form approach)
  const [showCreateInline, setShowCreateInline] = useState(false);
  const [createForRowId, setCreateForRowId] = useState<string | null>(null);
  const [createFirst, setCreateFirst] = useState('');
  const [createLast, setCreateLast] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createOwnershipPct, setCreateOwnershipPct] = useState<number>(100);
  const [createDisbursementPct, setCreateDisbursementPct] = useState<number>(100);
  const [createPrimary, setCreatePrimary] = useState<boolean>(false);
  const [creating, setCreating] = useState(false);
  // Image upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const sectionLabelClass = 'eyebrow-label';
  const formLabelClass = 'block text-sm font-medium text-muted-foreground';
  const formInputClass =
    'h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  const formatCurrency = (value?: number | null) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      Number(value),
    );
  };

  async function handleSyncToBuildium() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncErr(null);
    try {
      const res = await fetch(`/api/properties/${property.id}/sync`, { method: 'POST' });
      const j = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok || j?.error) {
        setSyncErr(j?.error || `Failed: HTTP ${res.status}`);
      } else {
        setSyncMsg('Synced to Buildium');
        // Update badge in-place without reload if possible
        if (j?.buildium_property_id)
          (property as Property).buildium_property_id = j.buildium_property_id;
      }
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  }

  // Load current property image (Buildium or local fallback)
  useEffect(() => {
    if (initialUrl) return;
    let cancelled = false;
    const loadImage = async () => {
      try {
        const res = await fetch(`/api/buildium/properties/${property.id}/images`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const j = await res.json().catch(() => null as Record<string, unknown> | null);
        const url =
          j?.data?.[0]?.Href || j?.data?.[0]?.Url || j?.data?.url || j?.data?.[0]?.href || null;
        if (!cancelled) setPreviewUrl(url || null);
      } catch {}
    };
    loadImage();
    return () => {
      cancelled = true;
    };
  }, [property.id, initialUrl]);

  // Also re-load when toggling out of edit mode (after save/cancel)
  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    const loadAfterEdit = async () => {
      try {
        const res = await fetch(`/api/buildium/properties/${property.id}/images`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = await res.json().catch(() => null as Record<string, unknown> | null);
        const url =
          j?.data?.[0]?.Href || j?.data?.[0]?.Url || j?.data?.url || j?.data?.[0]?.href || null;
        if (!cancelled) setPreviewUrl(url || null);
      } catch {}
    };
    loadAfterEdit();
    return () => {
      cancelled = true;
    };
  }, [editing, property.id]);

  // If owners are empty, try to hydrate from the details API (RLS/admin-backed)
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        if ((owners || []).length > 0) return;
        const res = await fetch(`/api/properties/${property.id}/details`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data?.owners) ? data.owners : [];
        if (!cancelled && list.length) {
          setOwners(
            list.map((o: Owner) => ({
              id: String(o.owner_id || o.id || crypto.randomUUID()),
              ownerId: String(o.owner_id || o.id || ''),
              name:
                o.display_name ||
                o.company_name ||
                `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() ||
                'Owner',
              ownershipPercentage: Number(o.ownership_percentage ?? 0),
              disbursementPercentage: Number(o.disbursement_percentage ?? 0),
              primary: Boolean(o.primary),
            })),
          );
        }
      } catch {}
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [owners, property.id]);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const uniqById = (arr: { id: string; name: string }[]) => {
      const seen = new Set<string>();
      const out: { id: string; name: string }[] = [];
      for (const it of arr) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push(it);
        }
      }
      return out;
    };
    const load = async () => {
      try {
        setLoadingOwners(true);
        setError(null);
        // Seed with already-linked owners so selects show current values immediately
        const seeded = owners
          .filter((o) => o.ownerId)
          .map((o) => ({ id: String(o.ownerId), name: o.name || 'Owner' }));
        if (!cancelled && seeded.length) {
          setOwnerOptions((prev) => uniqById([...seeded, ...prev]));
        }
        // Fetch full list and merge
        const res = await fetch('/api/owners');
        if (!res.ok) throw new Error('Failed to load owners');
        const data = await res.json();
        if (!cancelled) {
          const fetched = (Array.isArray(data) ? data : []).map((o: OwnerAPIResponse) => ({
            id: String(o.id),
            name:
              o.displayName ||
              o.name ||
              `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() ||
              o.companyName ||
              'Owner',
          }));
          setOwnerOptions((prev) => uniqById([...prev, ...fetched]));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load owners');
      } finally {
        if (!cancelled) setLoadingOwners(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editing, owners]);

  // Load staff and filter for role = PROPERTY_MANAGER (space/underscore tolerant)
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/staff');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const options = (Array.isArray(data) ? data : [])
            .filter(
              (s: StaffMember) =>
                String(s.role || '')
                  .toUpperCase()
                  .replace(/\s+/g, '_') === 'PROPERTY_MANAGER',
            )
            .map((s: StaffMember) => ({
              id: String(s.id),
              name:
                s.displayName ||
                `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() ||
                `Staff ${s.id}`,
              role: s.role,
            }));
          setManagerOptions(options);
          // Initialize selection from current property if available
          if (!managerId && property?.property_manager_id) {
            setManagerId(String(property.property_manager_id));
          }
        }
      } catch {}
    };
    loadStaff();
    return () => {
      cancelled = true;
    };
  }, [editing, managerId, property.property_manager_id]);

  function addOwnerRow() {
    setOwners((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ownerId: '',
        name: '',
        ownershipPercentage: 0,
        disbursementPercentage: 0,
      },
    ]);
  }

  function removeOwnerRow(id: string) {
    setOwners((prev) => prev.filter((o) => o.id !== id));
  }

  function setPrimaryOwner(id: string) {
    setOwners((prev) => prev.map((o) => ({ ...o, primary: o.id === id })));
  }

  function onOwnerSelect(rowId: string, ownerId: string) {
    if (ownerId === 'create-new-owner') {
      setShowCreateInline(true);
      setCreateForRowId(rowId);
      setCreateOwnershipPct(owners.length ? 0 : 100);
      setCreateDisbursementPct(owners.length ? 0 : 100);
      setCreatePrimary(owners.every((o) => !o.primary));
      return;
    }
    const opt = ownerOptions.find((o) => o.id === ownerId);
    setOwners((prev) =>
      prev.map((o) => (o.id === rowId ? { ...o, ownerId, name: opt?.name || '' } : o)),
    );
  }

  const ownershipTotal = useMemo(
    () => owners.reduce((s, o) => s + (Number(o.ownershipPercentage) || 0), 0),
    [owners],
  );

  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  // Fetch CSRF token when entering edit mode (cookie is httpOnly; we use JSON token)
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' });
        const j = await res.json().catch(() => ({}) as Record<string, unknown>);
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

  async function createOwnerInline() {
    try {
      setCreating(true);
      setError(null);
      if (!createFirst || !createLast || !createEmail) {
        setError('First name, last name, and email are required');
        return;
      }
      const csrf = csrfToken;
      const res = await fetch('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({
          isCompany: false,
          firstName: createFirst,
          lastName: createLast,
          primaryEmail: createEmail,
          primaryPhone: createPhone || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as Record<string, unknown>);
        throw new Error(j?.error || 'Failed to create owner');
      }
      const j = await res.json();
      const newOwner = j?.owner;
      if (newOwner?.id) {
        const name =
          newOwner.displayName ||
          `${newOwner.firstName ?? ''} ${newOwner.lastName ?? ''}`.trim() ||
          'Owner';
        setOwnerOptions((prev) => [{ id: String(newOwner.id), name }, ...prev]);
        if (createForRowId) {
          setOwners((prev) =>
            prev.map((o) =>
              o.id === createForRowId
                ? {
                    ...o,
                    ownerId: String(newOwner.id),
                    name,
                    ownershipPercentage: createOwnershipPct,
                    disbursementPercentage: createDisbursementPct,
                    primary: createPrimary || o.primary,
                  }
                : o,
            ),
          );
        } else {
          setOwners((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              ownerId: String(newOwner.id),
              name,
              ownershipPercentage: createOwnershipPct,
              disbursementPercentage: createDisbursementPct,
              primary: createPrimary,
            },
          ]);
        }
      }
      // reset and hide
      setShowCreateInline(false);
      setCreateForRowId(null);
      setCreateFirst('');
      setCreateLast('');
      setCreateEmail('');
      setCreatePhone('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create owner');
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const body: Record<string, unknown> = {
        address_line1: address1,
        city,
        state,
        postal_code: postal,
        // owners added below conditionally
        // Include required fields expected by the API using existing values
        name: property.name,
        country: property.country || 'United States',
        status: property.status || 'Active',
        property_type: property.property_type ?? null,
        reserve: property.reserve ?? 0,
        year_built: property.year_built ?? null,
        property_manager_id: managerId || null,
      };
      const ownersPayload = owners
        .filter((o) => o.ownerId)
        .map((o) => ({
          id: o.ownerId,
          ownershipPercentage: Number(o.ownershipPercentage) || 0,
          disbursementPercentage: Number(o.disbursementPercentage) || 0,
          primary: Boolean(o.primary),
        }));
      if (ownersPayload.length > 0) {
        body.owners = ownersPayload;
      }
      const csrf = csrfToken;
      // include org context header if present in cookie
      const orgHeader: Record<string, string> = {};
      if (typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|; )x-org-id=([^;]+)/);
        if (m) orgHeader['x-org-id'] = decodeURIComponent(m[1]);
      }
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
          ...orgHeader,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}) as Record<string, unknown>);
        throw new Error(j?.error || 'Failed to save property');
      }
      // Refresh page to reflect saved values
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save property');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="section-title-row">
        <h2 className="section-title-text">Property Details</h2>
        {!editing && <EditLink onClick={() => setEditing(true)} />}
      </div>
      <InlineEditCard
        title="Property Details"
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSave={save}
        isSaving={saving}
        canSave={ownershipTotal === 100}
        variant="plain"
        headerHidden={true}
        titleHidden={true}
        className="surface-card p-6"
        view={
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-5">
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-5">
              <div className="flex items-center gap-2">
                {syncMsg && (
                  <span className="text-sm font-medium text-[var(--color-action-600)] dark:text-[var(--color-action-300)]">
                    {syncMsg}
                  </span>
                )}
                {syncErr && (
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    {syncErr}
                  </span>
                )}
              </div>
              {!property.buildium_property_id && (
                <Button size="sm" onClick={handleSyncToBuildium} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync to Buildium'}
                </Button>
              )}
            </div>
            <div className="relative md:col-span-2">
              <div className="bg-card w-full overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
                {/* Fixed aspect ratio ~ 429x322 (≈ 75%) */}
                <div className="relative w-full pb-[75%]">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Property"
                      fill
                      priority
                      sizes="(min-width:1024px) 429px, 100vw"
                      className="absolute inset-0 object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="text-muted-foreground h-14 w-14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 7v13h16V7H4z" />
                        <path d="M22 7V5H2v2" />
                        <circle cx="12" cy="13" r="3" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              {/* Dedicated image action below image (independent of edit state) */}
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload property image"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploading(true);
                      setUploadError(null);
                      setUploadSuccess(null);
                      // Local preview while uploading
                      const obj = URL.createObjectURL(file);
                      setPreviewUrl(obj);
                      const toBase64 = (f: File) =>
                        new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result || ''));
                          reader.onerror = () => reject(new Error('Failed to read file'));
                          reader.readAsDataURL(f);
                        });
                      const dataUrl = await toBase64(file);
                      const base64 = dataUrl.split(',')[1] || '';
                      if (!base64) throw new Error('Invalid image data');
                      const res = await fetch(`/api/buildium/properties/${property.id}/images`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ FileName: file.name, FileData: base64 }),
                      });
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}) as Record<string, unknown>);
                        throw new Error(j?.error || 'Upload failed');
                      }
                      // Re-fetch canonical URL (Buildium or storage)
                      const check = await fetch(
                        `/api/buildium/properties/${property.id}/images?cb=${Date.now()}`,
                        { credentials: 'include', cache: 'no-store' },
                      );
                      const jj = await check
                        .json()
                        .catch(() => null as Record<string, unknown> | null);
                      const url =
                        jj?.data?.[0]?.Href ||
                        jj?.data?.[0]?.Url ||
                        jj?.data?.url ||
                        jj?.data?.[0]?.href ||
                        null;
                      setPreviewUrl(url || obj);
                      setUploadSuccess('Image uploaded');
                    } catch (err) {
                      setUploadError(err instanceof Error ? err.message : 'Failed to upload');
                    } finally {
                      setUploading(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="link"
                  className="w-fit px-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {previewUrl
                    ? uploading
                      ? 'Uploading…'
                      : 'Replace Image'
                    : uploading
                      ? 'Uploading…'
                      : 'Add Image'}
                </Button>
                {uploadError ? (
                  <p className="text-destructive mt-1 text-sm">{uploadError}</p>
                ) : null}
                {uploadSuccess ? (
                  <p className="text-primary mt-1 text-sm font-medium">{uploadSuccess}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-5 md:col-span-3">
              <div>
                <p className={sectionLabelClass}>Address</p>
                <p className="text-foreground text-sm leading-tight font-medium">
                  {property.address_line1}
                </p>
                {property.address_line2 ? (
                  <p className="text-foreground text-sm leading-tight font-medium">
                    {property.address_line2}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-sm leading-tight">
                  {property.city}, {property.state} {property.postal_code}
                </p>
              </div>
              <div>
                <p className={sectionLabelClass}>Property Manager</p>
                <div className="text-foreground text-sm">
                  {property.property_manager_name || 'No manager assigned'}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {property.property_manager_name
                    ? 'Primary point of contact'
                    : 'Assign a manager to surface contact details'}
                </p>
                {/* Intentionally omit email/phone — name only */}
              </div>
              <div>
                <p className={sectionLabelClass}>Rental Owners</p>
                <div className="mt-2 space-y-1.5">
                  {(() => {
                    const displayOwners =
                      property.owners && property.owners.length > 0 ? property.owners : owners;
                    return displayOwners && displayOwners.length > 0 ? (
                      <>
                        <div className="text-muted-foreground card-divider flex items-center justify-between border-b pb-1.5 text-sm">
                          <span className="sr-only md:not-sr-only">Name</span>
                          <div className="grid min-w-[140px] grid-cols-2 gap-8 text-right">
                            <span>Ownership</span>
                            <span>Disbursement</span>
                          </div>
                        </div>
                        {displayOwners.map((o: Owner, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="text-foreground truncate text-sm leading-tight">
                                {o.company_name ||
                                  `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() ||
                                  'Unnamed Owner'}
                              </p>
                              {o.primary && (
                                <Badge variant="secondary" className="text-xs">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <div className="text-foreground grid min-w-[140px] grid-cols-2 gap-8 text-right text-sm whitespace-nowrap">
                              <span className="font-medium">
                                {o.ownership_percentage != null
                                  ? `${o.ownership_percentage}%`
                                  : '—'}
                              </span>
                              <span className="font-medium">
                                {o.disbursement_percentage != null
                                  ? `${o.disbursement_percentage}%`
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="card-divider mt-1 flex items-center justify-between border-t pt-2">
                          <span className="text-foreground text-sm font-medium">Total</span>
                          <div className="grid min-w-[140px] grid-cols-2 gap-8 text-right text-sm">
                            <span className="font-bold">
                              {(() => {
                                const list = displayOwners;
                                const t = list.reduce(
                                  (a: number, o: Owner) => a + (o.ownership_percentage || 0),
                                  0,
                                );
                                return `${t}%`;
                              })()}
                            </span>
                            <span className="font-bold">
                              {(() => {
                                const list = displayOwners;
                                const t = list.reduce(
                                  (a: number, o: Owner) => a + (o.disbursement_percentage || 0),
                                  0,
                                );
                                return `${t}%`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">No owners assigned</p>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        }
        edit={
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
              {/* Address */}
              <div>
                <h4 className="text-foreground mb-2 text-sm font-medium">Address Information</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={`${formLabelClass} mb-1`}>Street Address</label>
                    <input
                      value={address1}
                      onChange={(e) => setAddress1(e.target.value)}
                      className={formInputClass}
                      placeholder="123 Main Street"
                      aria-label="Street address"
                    />
                  </div>
                  <div>
                    <label className={`${formLabelClass} mb-1`}>City</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={formInputClass}
                      placeholder="City"
                      aria-label="City"
                    />
                  </div>
                  <div>
                    <label className={`${formLabelClass} mb-1`}>State</label>
                    <input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className={formInputClass}
                      placeholder="NY"
                      aria-label="State"
                    />
                  </div>
                  <div>
                    <label className={`${formLabelClass} mb-1`}>Zip Code</label>
                    <input
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      className={formInputClass}
                      placeholder="11217"
                      aria-label="Zip code"
                    />
                  </div>
                </div>
              </div>

              {/* Property Management */}
              <div>
                <h4 className="text-foreground mb-2 text-sm font-medium">Property Management</h4>
                <label className={`${formLabelClass} mb-1`}>Property Manager</label>
                <select
                  className={`${formInputClass} pr-10`}
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  aria-label="Property manager"
                >
                  <option value="">No manager assigned</option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rental Owners */}
              <RepeaterField title="Rental Owner" onAdd={addOwnerRow} addLabel="Add another owner">
                <div className="space-y-2">
                  {owners.map((row) => (
                    <div key={row.id} className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-5">
                        <label className={`${formLabelClass} mb-1`}>Owner Name</label>
                        <select
                          value={row.ownerId}
                          onChange={(e) => onOwnerSelect(row.id, e.target.value)}
                          className={`${formInputClass} pr-10`}
                          aria-label="Owner selection"
                        >
                          <option value="">Select owner…</option>
                          <option value="create-new-owner">+ Create new owner…</option>
                          {ownerOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={`${formLabelClass} mb-1`}>Ownership %</label>
                        <input
                          type="number"
                          value={row.ownershipPercentage}
                          onChange={(e) =>
                            setOwners((prev) =>
                              prev.map((o) =>
                                o.id === row.id
                                  ? { ...o, ownershipPercentage: Number(e.target.value) }
                                  : o,
                              ),
                            )
                          }
                          className={formInputClass}
                          aria-label="Ownership percentage"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={`${formLabelClass} mb-1`}>Disbursement %</label>
                        <input
                          type="number"
                          value={row.disbursementPercentage}
                          onChange={(e) =>
                            setOwners((prev) =>
                              prev.map((o) =>
                                o.id === row.id
                                  ? { ...o, disbursementPercentage: Number(e.target.value) }
                                  : o,
                              ),
                            )
                          }
                          className={formInputClass}
                          aria-label="Disbursement percentage"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <label className="text-muted-foreground text-sm">Primary</label>
                        <input
                          type="radio"
                          name="primary-owner"
                          checked={!!row.primary}
                          onChange={() => setPrimaryOwner(row.id)}
                          aria-label="Set as primary owner"
                          className="accent-primary h-4 w-4"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          className="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive focus-visible:ring-offset-background flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                          aria-label="Remove owner"
                          onClick={() => removeOwnerRow(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {ownershipTotal !== 100 && (
                    <p className="text-destructive text-sm">
                      Ownership total is {ownershipTotal}%. It must equal 100% to save.
                    </p>
                  )}

                  {showCreateInline && (
                    <div className="border-border bg-muted/10 dark:bg-muted/20 mt-4 space-y-3 rounded-md border p-3">
                      <h5 className="text-foreground text-sm font-medium">New Owner</h5>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={`${formLabelClass} mb-1`}>First name</label>
                          <input
                            value={createFirst}
                            onChange={(e) => setCreateFirst(e.target.value)}
                            className={formInputClass}
                            aria-label="First name"
                          />
                        </div>
                        <div>
                          <label className={`${formLabelClass} mb-1`}>Last name</label>
                          <input
                            value={createLast}
                            onChange={(e) => setCreateLast(e.target.value)}
                            className={formInputClass}
                            aria-label="Last name"
                          />
                        </div>
                        <div>
                          <label className={`${formLabelClass} mb-1`}>Email</label>
                          <input
                            type="email"
                            value={createEmail}
                            onChange={(e) => setCreateEmail(e.target.value)}
                            className={formInputClass}
                            aria-label="Email address"
                          />
                        </div>
                        <div>
                          <label className={`${formLabelClass} mb-1`}>Phone</label>
                          <input
                            value={createPhone}
                            onChange={(e) => setCreatePhone(e.target.value)}
                            className={formInputClass}
                            aria-label="Phone number"
                          />
                        </div>
                        <div>
                          <label className={`${formLabelClass} mb-1`}>Ownership %</label>
                          <input
                            type="number"
                            value={createOwnershipPct}
                            onChange={(e) => setCreateOwnershipPct(Number(e.target.value) || 0)}
                            className={formInputClass}
                            aria-label="Ownership percentage"
                          />
                        </div>
                        <div>
                          <label className={`${formLabelClass} mb-1`}>Disbursement %</label>
                          <input
                            type="number"
                            value={createDisbursementPct}
                            onChange={(e) => setCreateDisbursementPct(Number(e.target.value) || 0)}
                            className={formInputClass}
                            aria-label="Disbursement percentage"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="new-owner-primary"
                            type="checkbox"
                            checked={createPrimary}
                            onChange={(e) => setCreatePrimary(e.target.checked)}
                            className="border-border accent-primary h-4 w-4 rounded"
                          />
                          <label
                            htmlFor="new-owner-primary"
                            className="text-muted-foreground text-sm"
                          >
                            Primary owner
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                        <Button
                          onClick={createOwnerInline}
                          disabled={creating}
                          className="min-h-[2.75rem]"
                        >
                          {creating ? 'Creating…' : 'Create owner'}
                        </Button>
                        <Button
                          variant="cancel"
                          onClick={() => {
                            setShowCreateInline(false);
                            setCreateForRowId(null);
                          }}
                          className="min-h-[2.75rem]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </RepeaterField>

              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <Button
                onClick={save}
                disabled={saving || ownershipTotal !== 100}
                className="min-h-[2.75rem]"
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="cancel"
                onClick={() => setEditing(false)}
                className="min-h-[2.75rem]"
              >
                Cancel
              </Button>
            </div>
          </div>
        }
      />
    </>
  );
}
