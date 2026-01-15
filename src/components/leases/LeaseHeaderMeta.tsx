'use client';

import { useEffect, useState } from 'react';
import InlineEditCard from '@/components/form/InlineEditCard';
import EditLink from '@/components/ui/EditLink';
import { DateInput } from '@/components/ui/date-input';
import { Select } from '@/ui/select';
import { Checkbox } from '@/ui/checkbox';
import { Body, Heading, Label } from '@/ui/typography';

function parseDateOnly(input?: string | null): Date | null {
  if (!input) return null;
  const datePart = typeof input === 'string' ? input.slice(0, 10) : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    const [, y, m, d] = match;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputDate(d?: string | null) {
  const dt = parseDateOnly(d);
  if (!dt) return '';
  return dt.toISOString().slice(0, 10);
}

type LeaseUpdatePayload = {
  status?: string | null;
  term_type?: string | null;
  lease_type?: string | null;
  lease_from_date?: string | null;
  start_date?: string | null;
  lease_to_date?: string | null;
  end_date?: string | null;
};

type LeaseUpdateResponse = {
  lease?: LeaseUpdatePayload | null;
  buildium_sync_error?: string | null;
  error?: string | null;
};

export default function LeaseHeaderMeta({
  leaseId,
  buildiumLeaseId,
  status: initialStatus,
  leaseType: initialLeaseType,
  termType: initialTermType,
  startDate,
  endDate,
  titleText,
  backHref,
}: {
  leaseId: string | number;
  buildiumLeaseId?: string | number | null;
  status?: string | null;
  leaseType?: string | null;
  termType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  titleText: string;
  backHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrf, setCsrf] = useState<string | null>(null);

  const [status, setStatus] = useState(initialStatus || '');
  const [type, setType] = useState(initialTermType || initialLeaseType || 'Fixed');
  const [from, setFrom] = useState(toInputDate(startDate));
  const [to, setTo] = useState(toInputDate(endDate));
  const [evictionPending, setEvictionPending] = useState(false);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' });
        const j = (await res.json().catch(() => null)) as { token?: string } | null;
        if (!cancelled) setCsrf(j?.token || null);
      } catch {}
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const body: Record<string, string | null> = {
        status: status || null,
        lease_type: type || null,
        term_type: type || null,
        lease_from_date: from || null,
        lease_to_date: to || null,
      };
      const res = await fetch(`/api/leases/${leaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as LeaseUpdateResponse;
      const updated = payload?.lease;
      const syncError = payload?.buildium_sync_error;
      if (updated) {
        setStatus(updated.status ?? status);
        const nextType = updated.term_type || updated.lease_type || type;
        setType(nextType || '');
        setFrom(toInputDate(updated.lease_from_date ?? updated.start_date ?? from));
        setTo(toInputDate(updated.lease_to_date ?? updated.end_date ?? to));
      }
      if (!res.ok) {
        throw new Error(syncError || payload?.error || `Failed to update lease: HTTP ${res.status}`);
      }
      if (syncError) {
        setError(`Saved, but failed to sync to Buildium: ${syncError}`);
        return;
      }
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save lease');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Body
              as="a"
              data-lease-back-link
              href={backHref}
              size="sm"
              className="text-primary underline"
            >
              Back to unit
            </Body>
          </div>
          <Heading as="h1" size="h2">
            {titleText}
          </Heading>
          {/* Subtitle row */}
          <Body as="div" size="sm" tone="muted" className="flex items-center gap-2">
            <span>{status ? `${status} lease` : 'Lease'}</span>
            {buildiumLeaseId ? <span>| {String(buildiumLeaseId).padStart(6, '0')}</span> : null}
            {type ? <span>| {type}</span> : null}
            <span>
              | {formatDisplayDate(from || startDate)} – {formatDisplayDate(to || endDate)}
            </span>
            <EditLink onClick={() => setEditing(true)} />
          </Body>
        </div>
      )}

      {editing && (
        <div className="mt-3">
          <InlineEditCard
            title="Edit lease"
            editing={true}
            onEdit={() => {}}
            onCancel={() => setEditing(false)}
            onSave={save}
            isSaving={saving}
            canSave={true}
            variant="card"
            actionsPlacement="footer"
            onClose={() => setEditing(false)}
            titleHidden
            headerHidden
            className="shadow-sm"
            size="compact"
            view={null}
            edit={
              <div className="max-w-3xl">
                <div className="flex flex-nowrap items-end gap-4">
                  <div className="w-40 min-w-[10rem] space-y-2">
                    <Label
                      tone="muted"
                      size="xs"
                      className="mb-1 block tracking-wide uppercase"
                    >
                      Status
                    </Label>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="text-foreground bg-background h-9 w-full rounded-md border border-border px-2 text-sm"
                      aria-label="Lease status"
                    >
                      {[
                        { v: 'Active', l: 'Active' },
                        { v: 'Draft', l: 'Draft' },
                        { v: 'Expired', l: 'Expired' },
                        { v: 'Terminated', l: 'Terminated' },
                        { v: 'Renewed', l: 'Renewed' },
                        { v: 'PENDING_SIGNATURE', l: 'Pending signature' },
                      ].map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-40 min-w-[10rem] space-y-2">
                    <Label
                      tone="muted"
                      size="xs"
                      className="mb-1 block tracking-wide uppercase"
                    >
                      Type
                    </Label>
                    <Select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="text-foreground bg-background h-9 w-full rounded-md border border-border px-2 text-sm"
                      aria-label="Lease type"
                    >
                      {['Fixed', 'FixedWithRollover', 'MonthToMonth', 'AtWill', 'Other'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
                    </Select>
                  </div>
                  <div className="w-40 min-w-[10rem] space-y-2">
                    <Label
                      tone="muted"
                      size="xs"
                      className="mb-1 block tracking-wide uppercase"
                    >
                      Start
                    </Label>
                    <DateInput
                      value={from}
                      onChange={setFrom}
                      placeholder="mm/dd/yyyy"
                      containerClassName="w-full"
                      className="text-sm"
                    />
                  </div>
                  <div className="w-40 min-w-[10rem] space-y-2">
                    <Label
                      tone="muted"
                      size="xs"
                      className="mb-1 block tracking-wide uppercase"
                    >
                      End
                    </Label>
                    <DateInput
                      value={to}
                      onChange={setTo}
                      placeholder="mm/dd/yyyy"
                      containerClassName="w-full"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="evict"
                    checked={evictionPending}
                    onChange={(e) => setEvictionPending(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label as="label" htmlFor="evict" className="text-sm">
                    Eviction pending
                  </Label>
                </div>
                {error ? (
                  <Body size="sm" className="text-destructive mt-2">
                    {error}
                  </Body>
                ) : null}
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}

function formatDisplayDate(input?: string | null): string {
  const parsed = parseDateOnly(input);
  if (!parsed) return '—';
  return parsed.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}
