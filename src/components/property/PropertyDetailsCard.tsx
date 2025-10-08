"use client"

import { useEffect, useMemo, useState, Fragment, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Plus } from 'lucide-react'
import InlineEditCard from '@/components/form/InlineEditCard'
import RepeaterField from '@/components/form/fields/RepeaterField'

type OwnerOption = { id: string; name: string }
type OwnerRow = { id: string; ownerId: string; name: string; ownershipPercentage: number; disbursementPercentage: number; primary?: boolean }

export default function PropertyDetailsCard({ property }: { property: any }) {
  const [editing, setEditing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncErr, setSyncErr] = useState<string | null>(null)
  // Use server-provided image first; client fetch only if missing
  const initialUrl = (property as any)?.primary_image_url || null
  const [address1, setAddress1] = useState(property.address_line1 || '')
  const [city, setCity] = useState(property.city || '')
  const [state, setState] = useState(property.state || '')
  const [postal, setPostal] = useState(property.postal_code || '')
  const [owners, setOwners] = useState<OwnerRow[]>(() => (property.owners || []).map((o: any) => ({
    id: String(o.owner_id || o.id || crypto.randomUUID()),
    ownerId: String(o.owner_id || o.id || ''),
    name: o.display_name || o.company_name || `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || 'Owner',
    ownershipPercentage: Number(o.ownership_percentage ?? 0),
    disbursementPercentage: Number(o.disbursement_percentage ?? 0),
    primary: Boolean(o.primary)
  })))
  const [managerId, setManagerId] = useState<string>('')
  const [managerOptions, setManagerOptions] = useState<{ id: string; name: string; role?: string }[]>([])
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([])
  const [loadingOwners, setLoadingOwners] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Inline create-new-owner state (mirrors New Property form approach)
  const [showCreateInline, setShowCreateInline] = useState(false)
  const [createForRowId, setCreateForRowId] = useState<string | null>(null)
  const [createFirst, setCreateFirst] = useState('')
  const [createLast, setCreateLast] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createOwnershipPct, setCreateOwnershipPct] = useState<number>(100)
  const [createDisbursementPct, setCreateDisbursementPct] = useState<number>(100)
  const [createPrimary, setCreatePrimary] = useState<boolean>(false)
  const [creating, setCreating] = useState(false)
  // Image upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl)

  async function handleSyncToBuildium() {
    setSyncing(true)
    setSyncMsg(null)
    setSyncErr(null)
    try {
      const res = await fetch(`/api/properties/${property.id}/sync`, { method: 'POST' })
      const j = await res.json().catch(() => ({} as any))
      if (!res.ok || j?.error) {
        setSyncErr(j?.error || `Failed: HTTP ${res.status}`)
      } else {
        setSyncMsg('Synced to Buildium')
        // Update badge in-place without reload if possible
        if (j?.buildium_property_id) (property as any).buildium_property_id = j.buildium_property_id
      }
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : 'Failed to sync')
    } finally {
      setSyncing(false)
    }
  }

  // Load current property image (Buildium or local fallback)
  useEffect(() => {
    if (initialUrl) return
    let cancelled = false
    const loadImage = async () => {
      try {
        const res = await fetch(`/api/buildium/properties/${property.id}/images`, { credentials: 'include' })
        if (!res.ok) return
        const j = await res.json().catch(() => null as any)
        const url = j?.data?.[0]?.Href || j?.data?.[0]?.Url || j?.data?.url || j?.data?.[0]?.href || null
        if (!cancelled) setPreviewUrl(url || null)
      } catch {}
    }
    loadImage()
    return () => { cancelled = true }
  }, [property.id, initialUrl])

  // Also re-load when toggling out of edit mode (after save/cancel)
  useEffect(() => {
    if (editing) return
    let cancelled = false
    const loadAfterEdit = async () => {
      try {
        const res = await fetch(`/api/buildium/properties/${property.id}/images`, { credentials: 'include', cache: 'no-store' })
        if (!res.ok) return
        const j = await res.json().catch(() => null as any)
        const url = j?.data?.[0]?.Href || j?.data?.[0]?.Url || j?.data?.url || j?.data?.[0]?.href || null
        if (!cancelled) setPreviewUrl(url || null)
      } catch {}
    }
    loadAfterEdit()
    return () => { cancelled = true }
  }, [editing, property.id])

  // If owners are empty, try to hydrate from the details API (RLS/admin-backed)
  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      try {
        if ((owners || []).length > 0) return
        const res = await fetch(`/api/properties/${property.id}/details`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data?.owners) ? data.owners : []
        if (!cancelled && list.length) {
          setOwners(list.map((o: any) => ({
            id: String(o.owner_id || o.id || crypto.randomUUID()),
            ownerId: String(o.owner_id || o.id || ''),
            name: o.display_name || o.company_name || `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || 'Owner',
            ownershipPercentage: Number(o.ownership_percentage ?? 0),
            disbursementPercentage: Number(o.disbursement_percentage ?? 0),
            primary: Boolean(o.primary)
          })))
        }
      } catch {}
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const uniqById = (arr: { id: string; name: string }[]) => {
      const seen = new Set<string>()
      const out: { id: string; name: string }[] = []
      for (const it of arr) { if (!seen.has(it.id)) { seen.add(it.id); out.push(it) } }
      return out
    }
    const load = async () => {
      try {
        setLoadingOwners(true)
        setError(null)
        // Seed with already-linked owners so selects show current values immediately
        const seeded = owners
          .filter(o => o.ownerId)
          .map(o => ({ id: String(o.ownerId), name: o.name || 'Owner' }))
        if (!cancelled && seeded.length) {
          setOwnerOptions(prev => uniqById([ ...seeded, ...prev ]))
        }
        // Fetch full list and merge
        const res = await fetch('/api/owners')
        if (!res.ok) throw new Error('Failed to load owners')
        const data = await res.json()
        if (!cancelled) {
          const fetched = (Array.isArray(data) ? data : []).map((o: any) => ({
            id: String(o.id),
            name: o.displayName || o.name || `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || o.companyName || 'Owner'
          }))
          setOwnerOptions(prev => uniqById([ ...prev, ...fetched ]))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load owners')
      } finally {
        if (!cancelled) setLoadingOwners(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editing])

  // Load staff and filter for role = PROPERTY_MANAGER (space/underscore tolerant)
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/staff')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          const options = (Array.isArray(data) ? data : [])
            .filter((s: any) => String(s.role || '').toUpperCase().replace(/\s+/g,'_') === 'PROPERTY_MANAGER')
            .map((s: any) => ({ id: String(s.id), name: s.displayName || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff ${s.id}`, role: s.role }))
          setManagerOptions(options)
          // Initialize selection from current property if available
          if (!managerId && property?.property_manager_id) {
            setManagerId(String(property.property_manager_id))
          }
        }
      } catch {}
    }
    loadStaff()
    return () => { cancelled = true }
  }, [editing])

  function addOwnerRow() {
    setOwners(prev => [...prev, { id: crypto.randomUUID(), ownerId: '', name: '', ownershipPercentage: 0, disbursementPercentage: 0 }])
  }

  function removeOwnerRow(id: string) {
    setOwners(prev => prev.filter(o => o.id !== id))
  }

  function setPrimaryOwner(id: string) {
    setOwners(prev => prev.map(o => ({ ...o, primary: o.id === id })))
  }

  function onOwnerSelect(rowId: string, ownerId: string) {
    if (ownerId === 'create-new-owner') {
      setShowCreateInline(true)
      setCreateForRowId(rowId)
      setCreateOwnershipPct(owners.length ? 0 : 100)
      setCreateDisbursementPct(owners.length ? 0 : 100)
      setCreatePrimary(owners.every(o => !o.primary))
      return
    }
    const opt = ownerOptions.find(o => o.id === ownerId)
    setOwners(prev => prev.map(o => o.id === rowId ? { ...o, ownerId, name: opt?.name || '' } : o))
  }

  const ownershipTotal = useMemo(() => owners.reduce((s, o) => s + (Number(o.ownershipPercentage) || 0), 0), [owners])

  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  // Fetch CSRF token when entering edit mode (cookie is httpOnly; we use JSON token)
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' })
        const j = await res.json().catch(() => ({} as any))
        if (!cancelled) setCsrfToken(j?.token || null)
      } catch {
        if (!cancelled) setCsrfToken(null)
      }
    }
    fetchToken()
    return () => { cancelled = true }
  }, [editing])

  async function createOwnerInline() {
    try {
      setCreating(true)
      setError(null)
      if (!createFirst || !createLast || !createEmail) {
        setError('First name, last name, and email are required')
        return
      }
      const csrf = csrfToken
      const res = await fetch('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ isCompany: false, firstName: createFirst, lastName: createLast, primaryEmail: createEmail, primaryPhone: createPhone || undefined })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any))
        throw new Error(j?.error || 'Failed to create owner')
      }
      const j = await res.json()
      const newOwner = j?.owner
      if (newOwner?.id) {
        const name = newOwner.displayName || `${newOwner.firstName ?? ''} ${newOwner.lastName ?? ''}`.trim() || 'Owner'
        setOwnerOptions(prev => [{ id: String(newOwner.id), name }, ...prev])
        if (createForRowId) {
          setOwners(prev => prev.map(o => o.id === createForRowId
            ? { ...o, ownerId: String(newOwner.id), name, ownershipPercentage: createOwnershipPct, disbursementPercentage: createDisbursementPct, primary: createPrimary || o.primary }
            : o
          ))
        } else {
          setOwners(prev => [...prev, { id: crypto.randomUUID(), ownerId: String(newOwner.id), name, ownershipPercentage: createOwnershipPct, disbursementPercentage: createDisbursementPct, primary: createPrimary }])
        }
      }
      // reset and hide
      setShowCreateInline(false)
      setCreateForRowId(null)
      setCreateFirst(''); setCreateLast(''); setCreateEmail(''); setCreatePhone('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create owner')
    } finally {
      setCreating(false)
    }
  }

  async function save() {
    try {
      setSaving(true)
      setError(null)
      const body: any = {
        address_line1: address1,
        city,
        state,
        postal_code: postal,
        // owners added below conditionally
        // Include required fields expected by the API using existing values
        name: property.name,
        country: property.country || 'United States',
        status: property.status || 'Active',
        property_type: (property as any).property_type ?? null,
        reserve: property.reserve ?? 0,
        year_built: property.year_built ?? null,
        property_manager_id: managerId || null
      }
      const ownersPayload = owners.filter(o => o.ownerId).map(o => ({
        id: o.ownerId,
        ownershipPercentage: Number(o.ownershipPercentage) || 0,
        disbursementPercentage: Number(o.disbursementPercentage) || 0,
        primary: Boolean(o.primary)
      }))
      if (ownersPayload.length > 0) {
        body.owners = ownersPayload
      }
      const csrf = csrfToken
      // include org context header if present in cookie
      const orgHeader: Record<string,string> = {}
      if (typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|; )x-org-id=([^;]+)/)
        if (m) orgHeader['x-org-id'] = decodeURIComponent(m[1])
      }
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}), ...orgHeader },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any))
        throw new Error(j?.error || 'Failed to save property')
      }
      // Refresh page to reflect saved values
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save property')
    } finally {
      setSaving(false)
    }
  }

  return (
    <InlineEditCard
      title="Property Details"
      editing={editing}
      onEdit={()=> setEditing(true)}
      onCancel={()=> setEditing(false)}
      onSave={save}
      isSaving={saving}
      canSave={ownershipTotal === 100}
      variant="plain"
      view={
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {syncMsg && <span className="text-xs text-green-600">{syncMsg}</span>}
              {syncErr && <span className="text-xs text-red-600">{syncErr}</span>}
            </div>
            {!property.buildium_property_id && (
              <Button size="sm" onClick={handleSyncToBuildium} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync to Buildium'}
              </Button>
            )}
          </div>
          <div className="relative md:col-span-2">
            <div className="w-full bg-muted rounded-lg overflow-hidden">
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
                    <svg className="h-14 w-14 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7v13h16V7H4z"/><path d="M22 7V5H2v2"/><circle cx="12" cy="13" r="3"/></svg>
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
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    setUploading(true)
                    setUploadError(null)
                    setUploadSuccess(null)
                    // Local preview while uploading
                    const obj = URL.createObjectURL(file)
                    setPreviewUrl(obj)
                    const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => resolve(String(reader.result || ''))
                      reader.onerror = () => reject(new Error('Failed to read file'))
                      reader.readAsDataURL(f)
                    })
                    const dataUrl = await toBase64(file)
                    const base64 = dataUrl.split(',')[1] || ''
                    if (!base64) throw new Error('Invalid image data')
                    const res = await fetch(`/api/buildium/properties/${property.id}/images`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ FileName: file.name, FileData: base64 }),
                    })
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({} as any))
                      throw new Error(j?.error || 'Upload failed')
                    }
                    // Re-fetch canonical URL (Buildium or storage)
                    const check = await fetch(`/api/buildium/properties/${property.id}/images?cb=${Date.now()}`, { credentials: 'include', cache: 'no-store' })
                    const jj = await check.json().catch(() => null as any)
                    const url = jj?.data?.[0]?.Href || jj?.data?.[0]?.Url || jj?.data?.url || jj?.data?.[0]?.href || null
                    setPreviewUrl(url || obj)
                    setUploadSuccess('Image uploaded')
                  } catch (err) {
                    setUploadError(err instanceof Error ? err.message : 'Failed to upload')
                  } finally {
                    setUploading(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary text-sm underline disabled:opacity-50"
                disabled={uploading}
              >
                {previewUrl ? (uploading ? 'Uploading…' : 'Replace Image') : (uploading ? 'Uploading…' : 'Add Image')}
              </button>
              {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
              {uploadSuccess ? <p className="mt-1 text-xs text-emerald-600">{uploadSuccess}</p> : null}
            </div>
          </div>
          <div className="space-y-5 md:col-span-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</p>
              <p className="text-sm font-medium text-foreground leading-tight">{property.address_line1}</p>
              {property.address_line2 ? <p className="text-sm font-medium text-foreground leading-tight">{property.address_line2}</p> : null}
              <p className="text-sm text-muted-foreground leading-tight">{property.city}, {property.state} {property.postal_code}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Property Manager</p>
              <div className="text-sm text-foreground">
                {property.property_manager_name || 'No manager assigned'}
              </div>
              {/* Intentionally omit email/phone — name only */}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rental Owners</p>
              <div className="mt-2 space-y-1.5">
                {(() => { const displayOwners = (property.owners && property.owners.length > 0) ? property.owners : owners; return displayOwners && displayOwners.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-1.5 border-b border-border">
                      <span className="sr-only md:not-sr-only">Name</span>
                      <div className="grid grid-cols-2 gap-8 min-w-[140px] text-right">
                        <span>Ownership</span>
                        <span>Disbursement</span>
                      </div>
                    </div>
                    {displayOwners.map((o: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm text-foreground truncate leading-tight">{o.company_name || `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || 'Unnamed Owner'}</p>
                          {o.primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                        </div>
                        <div className="grid grid-cols-2 gap-8 text-sm text-foreground whitespace-nowrap text-right min-w-[140px]">
                          <span className="font-medium">{o.ownership_percentage != null ? `${o.ownership_percentage}%` : '—'}</span>
                          <span className="font-medium">{o.disbursement_percentage != null ? `${o.disbursement_percentage}%` : '—'}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                      <span className="text-sm font-medium text-foreground">Total</span>
                      <div className="grid grid-cols-2 gap-8 text-sm text-right min-w-[140px]">
                        <span className="font-bold">{(() => {
                          const list = displayOwners
                          const t = list.reduce((a: number, o: any) => a + (o.ownership_percentage || 0), 0)
                          return `${t}%`
                        })()}</span>
                        <span className="font-bold">{(() => {
                          const list = displayOwners
                          const t = list.reduce((a: number, o: any) => a + (o.disbursement_percentage || 0), 0)
                          return `${t}%`
                        })()}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No owners assigned</p>
                )})()}
              </div>
            </div>
          </div>
        </div>
      }
      edit={
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          <div className="relative md:col-span-2">
            <div className="w-full bg-muted rounded-lg overflow-hidden">
              <div className="relative w-full pb-[75%]">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Property" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="h-14 w-14 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7v13h16V7H4z"/><path d="M22 7V5H2v2"/><circle cx="12" cy="13" r="3"/></svg>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-6 md:col-span-3">
            {/* Address */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Address Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Street Address</label>
                  <input value={address1} onChange={e=>setAddress1(e.target.value)} className="w-full h-9 px-3 border border-border rounded-md bg-background text-foreground text-sm" placeholder="123 Main Street" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">City</label>
                  <input value={city} onChange={e=>setCity(e.target.value)} className="w-full h-9 px-3 border border-border rounded-md bg-background text-foreground text-sm" placeholder="City" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">State</label>
                  <input value={state} onChange={e=>setState(e.target.value)} className="w-full h-9 px-3 border border-border rounded-md bg-background text-foreground text-sm" placeholder="NY" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Zip Code</label>
                  <input value={postal} onChange={e=>setPostal(e.target.value)} className="w-full h-9 px-3 border border-border rounded-md bg-background text-foreground text-sm" placeholder="11217" />
                </div>
              </div>
            </div>

            {/* Property Management */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Property Management</h4>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Property Manager</label>
              <select
                className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm"
                value={managerId}
                onChange={(e)=> setManagerId(e.target.value)}
              >
                <option value="">No manager assigned</option>
                {managerOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Rental Owners */}
            <RepeaterField title="Rental Owner" onAdd={addOwnerRow} addLabel="Add another owner">
              <div className="space-y-2">
                {owners.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5">
                      <label className="block text-xs text-muted-foreground mb-1">Owner Name</label>
                      <select
                        value={row.ownerId}
                        onChange={e=> onOwnerSelect(row.id, e.target.value)}
                        className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm"
                      >
                        <option value="">Select owner…</option>
                        <option value="create-new-owner">+ Create new owner…</option>
                        {ownerOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Ownership %</label>
                      <input type="number" value={row.ownershipPercentage}
                        onChange={e=> setOwners(prev => prev.map(o => o.id===row.id ? { ...o, ownershipPercentage: Number(e.target.value) } : o))}
                        className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Disbursement %</label>
                      <input type="number" value={row.disbursementPercentage}
                        onChange={e=> setOwners(prev => prev.map(o => o.id===row.id ? { ...o, disbursementPercentage: Number(e.target.value) } : o))}
                        className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm" />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Primary</label>
                      <input type="radio" name="primary-owner" checked={!!row.primary} onChange={()=> setPrimaryOwner(row.id)} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" className="text-destructive" aria-label="Remove owner" onClick={()=> removeOwnerRow(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {ownershipTotal !== 100 && (
                  <p className="text-xs text-destructive">Ownership total is {ownershipTotal}%. It must equal 100% to save.</p>
                )}

                {showCreateInline && (
                  <div className="mt-4 rounded-md border p-3 space-y-3">
                    <h5 className="text-sm font-medium text-foreground">New Owner</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">First name</label>
                        <input value={createFirst} onChange={e=>setCreateFirst(e.target.value)} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Last name</label>
                        <input value={createLast} onChange={e=>setCreateLast(e.target.value)} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Email</label>
                        <input type="email" value={createEmail} onChange={e=>setCreateEmail(e.target.value)} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                        <input value={createPhone} onChange={e=>setCreatePhone(e.target.value)} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Ownership %</label>
                        <input type="number" value={createOwnershipPct} onChange={e=>setCreateOwnershipPct(Number(e.target.value)||0)} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Disbursement %</label>
                        <input type="number" value={createDisbursementPct} onChange={e=>setCreateDisbursementPct(Number(e.target.value)||0)} className="w-full h-9 px-2 border rounded-md bg-background text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input id="new-owner-primary" type="checkbox" checked={createPrimary} onChange={e=>setCreatePrimary(e.target.checked)} />
                        <label htmlFor="new-owner-primary" className="text-xs text-muted-foreground">Primary owner</label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={createOwnerInline} disabled={creating}> {creating ? 'Creating…' : 'Create owner'} </Button>
                      <Button variant="ghost" size="sm" onClick={()=>{ setShowCreateInline(false); setCreateForRowId(null) }}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </RepeaterField>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      }
    />
  )
}
