"use client"

import { useEffect, useMemo, useState, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Plus } from 'lucide-react'
import InlineEditCard from '@/components/form/InlineEditCard'
import RepeaterField from '@/components/form/fields/RepeaterField'

type OwnerOption = { id: string; name: string }
type OwnerRow = { id: string; ownerId: string; name: string; ownershipPercentage: number; disbursementPercentage: number; primary?: boolean }

export default function PropertyDetailsCard({ property }: { property: any }) {
  const [editing, setEditing] = useState(false)
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

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingOwners(true)
        setError(null)
        const res = await fetch('/api/owners')
        if (!res.ok) throw new Error('Failed to load owners')
        const data = await res.json()
        if (!cancelled) {
          setOwnerOptions((Array.isArray(data) ? data : []).map((o: any) => ({
            id: String(o.id),
            name: o.displayName || o.name || `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || o.companyName || 'Owner'
          })))
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

  // Load staff and filter for roles containing "Property Manager"
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
            .filter((s: any) => String(s.role || '').toLowerCase().includes('property manager'))
            .map((s: any) => ({ id: String(s.id), name: s.displayName || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || `Staff ${s.id}`, role: s.role }))
          setManagerOptions(options)
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
        owners: owners.filter(o => o.ownerId).map(o => ({
          id: o.ownerId,
          ownershipPercentage: Number(o.ownershipPercentage) || 0,
          disbursementPercentage: Number(o.disbursementPercentage) || 0,
          primary: Boolean(o.primary)
        })),
        // Include required fields expected by the API using existing values
        name: property.name,
        country: property.country || 'United States',
        status: property.status || 'Active',
        property_type: (property as any).property_type ?? null,
        reserve: property.reserve ?? 0,
        year_built: property.year_built ?? null,
        property_manager_id: managerId || null
      }
      const csrf = csrfToken
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
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
      view={
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          <div className="relative md:col-span-2">
            <div className="w-full h-56 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {/* Placeholder image area */}
              <svg className="h-14 w-14 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7v13h16V7H4z"/><path d="M22 7V5H2v2"/><circle cx="12" cy="13" r="3"/></svg>
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
              <p className="text-sm text-foreground">{property.property_manager_name || 'No manager assigned'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rental Owners</p>
              <div className="mt-2 space-y-1.5">
                {property.owners && property.owners.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-1.5 border-b border-border">
                      <span className="sr-only md:not-sr-only">Name</span>
                      <div className="grid grid-cols-2 gap-8 min-w-[140px] text-right">
                        <span>Ownership</span>
                        <span>Disbursement</span>
                      </div>
                    </div>
                    {property.owners.map((o: any, idx: number) => (
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
                          const t = property.owners.reduce((a: number, o: any) => a + (o.ownership_percentage || 0), 0)
                          return `${t}%`
                        })()}</span>
                        <span className="font-bold">{(() => {
                          const t = property.owners.reduce((a: number, o: any) => a + (o.disbursement_percentage || 0), 0)
                          return `${t}%`
                        })()}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No owners assigned</p>
                )}
              </div>
            </div>
          </div>
        </div>
      }
      edit={
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
          <div className="relative md:col-span-2">
            <div className="w-full h-56 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              <button type="button" className="text-primary text-sm underline">Replace photo</button>
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
                      <Button variant="outline" size="sm" onClick={()=>{ setShowCreateInline(false); setCreateForRowId(null) }}>Cancel</Button>
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
