"use client"

import { useEffect, useMemo, useState, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Plus, X, Save } from 'lucide-react'

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
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([])
  const [loadingOwners, setLoadingOwners] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    const opt = ownerOptions.find(o => o.id === ownerId)
    setOwners(prev => prev.map(o => o.id === rowId ? { ...o, ownerId, name: opt?.name || '' } : o))
  }

  const ownershipTotal = useMemo(() => owners.reduce((s, o) => s + (Number(o.ownershipPercentage) || 0), 0), [owners])

  const getCSRFCookie = (): string | null => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|; )csrf-token=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
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
        }))
      }
      const csrf = getCSRFCookie()
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
    <div className="rounded-lg shadow-sm border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Property Details</h2>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label="Edit property">
            <Edit className="h-4 w-4 mr-2"/>Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} aria-label="Cancel"><X className="h-4 w-4 mr-2"/>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving || ownershipTotal !== 100} aria-label="Save"><Save className="h-4 w-4 mr-2"/>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
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
                {(property.owners || []).map((o: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-foreground truncate mr-3">{o.company_name || `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || 'Unnamed Owner'}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{o.ownership_percentage ?? 0}% • {o.disbursement_percentage ?? 0}%</span>
                  </div>
                ))}
                {(!property.owners || property.owners.length === 0) && (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
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

            {/* Property Management (placeholder select) */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Property Management</h4>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Property Manager</label>
              <select className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm" disabled>
                <option>{property.property_manager_name || 'No manager assigned'}</option>
              </select>
            </div>

            {/* Rental Owners */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Rental Owner</h4>
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
                <div className="pt-1">
                  <button type="button" onClick={addOwnerRow} className="text-primary text-sm underline flex items-center"><Plus className="h-4 w-4 mr-1"/> Add another owner</button>
                </div>
                {ownershipTotal !== 100 && (
                  <p className="text-xs text-destructive">Ownership total is {ownershipTotal}%. It must equal 100% to save.</p>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

