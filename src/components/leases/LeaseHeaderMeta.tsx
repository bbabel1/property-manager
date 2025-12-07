"use client"

import { useEffect, useState } from 'react'
import InlineEditCard from '@/components/form/InlineEditCard'
import EditLink from '@/components/ui/EditLink'
import { DateInput } from '@/components/ui/date-input'

function toInputDate(d?: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 10)
}

export default function LeaseHeaderMeta({
  leaseId,
  buildiumLeaseId,
  status: initialStatus,
  leaseType: initialLeaseType,
  termType: initialTermType,
  startDate,
  endDate,
  unitDisplay,
  titleText,
  backHref,
}: {
  leaseId: string | number
  buildiumLeaseId?: string | number | null
  status?: string | null
  leaseType?: string | null
  termType?: string | null
  startDate?: string | null
  endDate?: string | null
  unitDisplay?: string | null
  titleText: string
  backHref: string
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csrf, setCsrf] = useState<string | null>(null)

  const [status, setStatus] = useState(initialStatus || '')
  const [type, setType] = useState(initialTermType || initialLeaseType || 'Fixed')
  const [from, setFrom] = useState(toInputDate(startDate))
  const [to, setTo] = useState(toInputDate(endDate))
  const [evictionPending, setEvictionPending] = useState(false)

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' })
        const j = await res.json().catch(() => null as any)
        if (!cancelled) setCsrf(j?.token || null)
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [editing])

  async function save() {
    try {
      setSaving(true); setError(null)
      const body: any = {
        status: status || null,
        lease_type: type || null,
        term_type: type || null,
        lease_from_date: from || null,
        lease_to_date: to || null,
      }
      const res = await fetch(`/api/leases/${leaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify(body)
      })
      const payload = await res.json().catch(() => ({} as any))
      const updated = payload?.lease ?? payload
      const syncError = payload?.buildium_sync_error
      if (updated) {
        setStatus(updated.status ?? status)
        const nextType = updated.term_type || updated.lease_type || type
        setType(nextType || '')
        setFrom(toInputDate(updated.lease_from_date ?? updated.start_date ?? from))
        setTo(toInputDate(updated.lease_to_date ?? updated.end_date ?? to))
      }
      if (!res.ok) {
        throw new Error(syncError || payload?.error || `Failed to update lease: HTTP ${res.status}`)
      }
      if (syncError) {
        setError(`Saved, but failed to sync to Buildium: ${syncError}`)
        return
      }
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save lease')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {!editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <a data-lease-back-link href={backHref} className="text-sm text-primary underline">Back to unit</a>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{titleText}</h1>
          {/* Subtitle row */}
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{status ? `${status} lease` : 'Lease'}</span>
            {buildiumLeaseId ? <span>| {String(buildiumLeaseId).padStart(6, '0')}</span> : null}
            {type ? <span>| {type}</span> : null}
            <span>| {formatDisplayDate(from || startDate)} – {formatDisplayDate(to || endDate)}</span>
            <EditLink onClick={() => setEditing(true)} />
          </div>
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
            onClose={()=> setEditing(false)}
            titleHidden
            headerHidden
            className="shadow-sm"
            size="compact"
            view={null}
            edit={(
              <div className="max-w-3xl">
                <div className="flex flex-nowrap gap-4 items-end">
                  <div className="space-y-2 min-w-[10rem] w-40">
                    <label className="block text-[11px] tracking-wide font-semibold text-muted-foreground uppercase mb-1">Status</label>
                    <select value={status} onChange={(e)=>setStatus(e.target.value)} className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm" aria-label="Lease status">
                      {[
                        { v: 'Active', l: 'Active' },
                        { v: 'Draft', l: 'Draft' },
                        { v: 'Expired', l: 'Expired' },
                        { v: 'Terminated', l: 'Terminated' },
                        { v: 'Renewed', l: 'Renewed' },
                        { v: 'PENDING_SIGNATURE', l: 'Pending signature' },
                      ].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 min-w-[10rem] w-40">
                    <label className="block text-[11px] tracking-wide font-semibold text-muted-foreground uppercase mb-1">Type</label>
                    <select value={type} onChange={(e)=>setType(e.target.value)} className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm" aria-label="Lease type">
                      {['Fixed','FixedWithRollover','MonthToMonth','AtWill','Other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 min-w-[10rem] w-40">
                    <label className="block text-[11px] tracking-wide font-semibold text-muted-foreground uppercase mb-1">Start</label>
                    <DateInput
                      value={from}
                      onChange={setFrom}
                      placeholder="mm/dd/yyyy"
                      containerClassName="w-full"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2 min-w-[10rem] w-40">
                    <label className="block text-[11px] tracking-wide font-semibold text-muted-foreground uppercase mb-1">End</label>
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
                  <input id="evict" type="checkbox" checked={evictionPending} onChange={(e)=>setEvictionPending(e.target.checked)} className="h-4 w-4" />
                  <label htmlFor="evict" className="text-sm">Eviction pending</label>
                </div>
                {error ? <p className="text-xs text-destructive mt-2">{error}</p> : null}
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

function formatDisplayDate(input?: string | null): string {
  if (!input) return '—'
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })
}
