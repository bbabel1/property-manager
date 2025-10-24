"use client"

import { useEffect, useState } from 'react'
import InlineEditCard from '@/components/form/InlineEditCard'
import EditLink from '@/components/ui/EditLink'
import { Button } from '@/components/ui/button'

export default function LocationCard({ property }: { property: any }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  const [borough, setBorough] = useState<string>(property.borough || '')
  const [neighborhood, setNeighborhood] = useState<string>(property.neighborhood || '')
  const [longitude, setLongitude] = useState<string>(() => property.longitude != null ? String(property.longitude) : '')
  const [latitude, setLatitude] = useState<string>(() => property.latitude != null ? String(property.latitude) : '')
  const [verified, setVerified] = useState<boolean>(!!property.location_verified)

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

  async function onSave() {
    try {
      setSaving(true)
      setError(null)
      if (!csrfToken) throw new Error('CSRF token not found')
      const body: any = {
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
        property_type: (property as any).property_type ?? null,
        reserve: property.reserve ?? 0,
        year_built: property.year_built ?? null,
        // Location fields
        borough: borough || null,
        neighborhood: neighborhood || null,
        longitude: longitude === '' ? null : Number(longitude),
        latitude: latitude === '' ? null : Number(latitude),
        location_verified: !!verified,
      }
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any))
        throw new Error(j?.error || 'Failed to update location')
      }
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update location')
    } finally {
      setSaving(false)
    }
  }

  const view = (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Borough</p>
          <p className="text-sm text-foreground mt-1">{borough || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Neighborhood</p>
          <p className="text-sm text-foreground mt-1">{neighborhood || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Longitude</p>
          <p className="text-sm text-foreground mt-1">{longitude !== '' ? longitude : '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latitude</p>
          <p className="text-sm text-foreground mt-1">{latitude !== '' ? latitude : '—'}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location Verified</p>
        <p className={`text-sm mt-1 ${verified ? 'text-emerald-600' : 'text-muted-foreground'}`}>{verified ? 'Verified' : 'Not verified'}</p>
      </div>
    </div>
  )

  const edit = (
    <div className="rounded-lg border border-gray-200 p-4 text-sm relative bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-sm" />
      <button type="button" aria-label="Close" onClick={()=> setEditing(false)} className="absolute right-3 top-3 text-gray-600 hover:text-gray-800">
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="space-y-6">
        {/* Location Information */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Location Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Borough</label>
              <input
                type="text"
                value={borough}
                onChange={(e) => setBorough(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-md bg-background text-foreground text-sm"
                placeholder="e.g., Manhattan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Neighborhood</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-md bg-background text-foreground text-sm"
                placeholder="e.g., Upper West Side"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-md bg-background text-foreground text-sm"
                placeholder="e.g., -73.9857"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full h-9 px-3 border border-gray-200 rounded-md bg-background text-foreground text-sm"
                placeholder="e.g., 40.7484"
              />
            </div>
          </div>
        </div>

        {/* Verification */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Verification</h4>
          <div className="flex items-center gap-2">
            <input id="verified" type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            <label htmlFor="verified" className="text-sm text-foreground">Location Verified</label>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      
      {/* Action Buttons */}
      <div className="mt-6 flex items-center gap-4">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="cancel" onClick={()=> setEditing(false)}>Cancel</Button>
      </div>
    </div>
  )

  return (
    <>
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <h2 className="text-lg font-semibold text-foreground">Location</h2>
        {!editing && <EditLink onClick={() => setEditing(true)} />}
      </div>
      <InlineEditCard
        title=""
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => { setEditing(false); setError(null) }}
        onSave={onSave}
        isSaving={saving}
        canSave={true}
        variant="plain"
        view={view}
        edit={edit}
        titleHidden={true}
        headerHidden={true}
      />
    </>
  )
}
