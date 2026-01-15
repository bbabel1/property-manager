"use client"

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import InlineEditCard from '@/components/form/InlineEditCard'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dropdown } from '@/components/ui/Dropdown'
import { BEDROOM_OPTIONS, BATHROOM_OPTIONS } from '@/types/units'
import { Body, Heading, Label } from '@/ui/typography'

type UnitCardProperty = {
  id?: string | null
  name?: string | null
  address_line1?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

type UnitCardUnit = {
  id?: string | number | null
  status?: string | null
  unit_bedrooms?: string | null
  unit_bathrooms?: string | null
  unit_size?: number | null
  unit_number?: string | null
  description?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  postal_code?: string | null
  buildium_unit_id?: string | number | null
}

type UnitImageResponse = {
  data?: Array<{ href?: string | null; Href?: string | null; Url?: string | null; id?: string | number | null }> | null
}

type UpdateUnitResponse = {
  unit?: Partial<UnitCardUnit> | null
  buildium_unit_id?: number | null
  buildium_sync_error?: string | null
  error?: string | null
}

const parseJson = async <T,>(res: Response, fallback: T): Promise<T> => {
  try {
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

export default function UnitDetailsCard({ property, unit }: { property: UnitCardProperty; unit: UnitCardUnit }) {
  const status = String(unit?.status || '').toLowerCase()
  const statusVariant =
    status === 'occupied'
      ? 'success'
      : status
        ? 'warning'
        : 'info'
  const bedrooms = unit?.unit_bedrooms ?? '—'
  const bathrooms = unit?.unit_bathrooms ?? '—'
  const size = unit?.unit_size ? `${unit.unit_size} sq ft` : '—'
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Edit fields
  const [unitNumber, setUnitNumber] = useState<string>(unit?.unit_number || '')
  const [unitBedrooms, setUnitBedrooms] = useState<string | ''>(unit?.unit_bedrooms || '')
  const [unitBathrooms, setUnitBathrooms] = useState<string | ''>(unit?.unit_bathrooms || '')
  const [unitSize, setUnitSize] = useState<string>(unit?.unit_size ? String(unit.unit_size) : '')
  const [notes, setNotes] = useState<string>(unit?.description || '')
  const [unitStatus, setUnitStatus] = useState<string>(unit?.status || 'Vacant')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewImageId, setPreviewImageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  // Load current unit image from Buildium (if buildium_unit_id exists)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        if (!unit?.id) return
        const res = await fetch(`/api/units/${unit.id}/images`, { credentials: 'include' })
        if (!res.ok) return
        const j = await parseJson<UnitImageResponse | null>(res, null)
        const first = Array.isArray(j?.data) && j.data.length ? j.data[0] : null
        const url = first?.href || first?.Href || first?.Url || null
        const imageRowId = first?.id ? String(first.id) : null
        if (!cancelled) { setPreviewUrl(url || null); setPreviewImageId(imageRowId) }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [unit])

  const view = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
      {/* Image placeholder to mirror property details layout */}
      <div className="relative md:col-span-2">
        <div className="w-full bg-muted rounded-lg overflow-hidden">
          <div className="relative w-full pb-[75%]">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Unit"
                fill
                unoptimized
                sizes="(min-width: 768px) 50vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-14 w-14 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7v13h16V7H4z"/><path d="M22 7V5H2v2"/><circle cx="12" cy="13" r="3"/></svg>
              </div>
            )}
          </div>
        </div>
        {/* Upload link below image (mirrors property details) */}
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload unit image"
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
                const res = await fetch(`/api/units/${unit.id}/images`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ FileName: file.name, FileData: base64, FileType: file.type })
                })
                if (!res.ok) {
                  const j = await parseJson<{ error?: string | null }>(res, {})
                  throw new Error(j?.error || 'Upload failed')
                }
                // refresh canonical
                const check = await fetch(`/api/units/${unit.id}/images?cb=${Date.now()}`, { credentials: 'include', cache: 'no-store' })
                const jj = await parseJson<UnitImageResponse | null>(check, null)
                const first = Array.isArray(jj?.data) && jj.data.length ? jj.data[0] : null
                const url = first?.href || first?.Href || first?.Url || null
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
          {uploadSuccess ? <p className="mt-1 text-xs text-primary-600">{uploadSuccess}</p> : null}
        </div>
      </div>
      <div className="space-y-5 md:col-span-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {status ? (
              <Badge variant={statusVariant} className="status-pill">
                {unit?.status}
              </Badge>
            ) : null}
            {unit?.buildium_unit_id ? (
              <Badge variant="secondary">{unit.buildium_unit_id}</Badge>
            ) : (
              <Badge variant="outline">Not in Buildium</Badge>
            )}
          </div>
          <Heading as="h2" size="h3" className="text-foreground">
            {(property?.address_line1 || property?.name || 'Property')}{unit?.unit_number ? ` - ${unit.unit_number}` : ''}
          </Heading>
        </div>

        {/* Address */}
        <div>
          <Label as="div" size="xs" tone="muted" className="tracking-wider uppercase">
            Address
          </Label>
          <Body as="p" size="sm" className="font-medium leading-tight text-foreground">
            {unit?.address_line1 || property?.address_line1 || '—'}
          </Body>
          {unit?.address_line2 ? (
            <Body as="p" size="sm" className="font-medium leading-tight text-foreground">
              {unit.address_line2}
            </Body>
          ) : null}
          <Body as="p" size="sm" tone="muted" className="leading-tight">
            {(unit?.city || property?.city) || '—'}{property?.state ? `, ${property.state}` : ''} {unit?.postal_code || property?.postal_code || ''}
          </Body>
        </div>

        {/* Specifications */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit Specifications</p>
          <div className="mt-1 flex items-center gap-6 text-sm text-foreground">
            <span>{bedrooms} Bedrooms</span>
            <span>{bathrooms} Bathrooms</span>
            <span>{size}</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
          <p className="text-sm text-foreground">{unit?.description || '—'}</p>
        </div>
      </div>
    </div>
  )

  const edit = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
      {/* Keep image block on the left */}
      <div className="relative md:col-span-2">
        <div className="w-full bg-muted rounded-lg overflow-hidden">
          <div className="relative w-full pb-[75%]">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Unit"
                fill
                unoptimized
                sizes="(min-width: 768px) 50vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-14 w-14 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7v13h16V7H4z"/><path d="M22 7V5H2v2"/><circle cx="12" cy="13" r="3"/></svg>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4">
          {/* Reuse image uploader */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-label="Upload unit image"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                setUploading(true); setUploadError(null); setUploadSuccess(null)
                const obj = URL.createObjectURL(file); setPreviewUrl(obj)
                const toBase64 = (f: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result||'')); r.onerror = () => reject(new Error('Failed to read')); r.readAsDataURL(f) })
                const dataUrl = await toBase64(file)
                const base64 = dataUrl.split(',')[1] || ''
                const res = await fetch(`/api/units/${unit.id}/images`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ FileName: file.name, FileData: base64, FileType: file.type })
                })
                if (!res.ok) { const j = await parseJson<{ error?: string | null }>(res, {}); throw new Error(j?.error || 'Upload failed') }
                const check = await fetch(`/api/units/${unit.id}/images?cb=${Date.now()}`, { credentials:'include', cache:'no-store' })
                const jj = await parseJson<UnitImageResponse | null>(check, null)
                const first = Array.isArray(jj?.data) && jj.data.length ? jj.data[0] : null
                const url = first?.href || first?.Href || first?.Url || null
                const imageRowId = first?.id ? String(first.id) : null
                setPreviewUrl(url || obj)
                setPreviewImageId(imageRowId)
                setUploadSuccess('Image uploaded')
              } catch (err) { setUploadError(err instanceof Error ? err.message : 'Failed to upload') } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary text-sm underline disabled:opacity-50" disabled={uploading}>
            {previewUrl ? (uploading ? 'Uploading…' : 'Replace Image') : (uploading ? 'Uploading…' : 'Add Image')}
          </button>
          {previewUrl && previewImageId ? (
            <button
              type="button"
              className="text-destructive text-sm underline disabled:opacity-50"
              onClick={async () => {
                if (!previewImageId) return
                try {
                  setUploading(true); setUploadError(null); setUploadSuccess(null)
                  const res = await fetch(`/api/units/${unit.id}/images/${previewImageId}`, { method: 'DELETE', credentials: 'include' })
                  if (!res.ok) { const j = await parseJson<{ error?: string | null }>(res, {}); throw new Error(j?.error || 'Failed to delete image') }
                  setPreviewUrl(null); setPreviewImageId(null); setUploadSuccess('Image removed')
                } catch (e) { setUploadError(e instanceof Error ? e.message : 'Failed to delete') } finally { setUploading(false) }
              }}
            >Remove Image</button>
          ) : null}
          {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
          {uploadSuccess ? <p className="mt-1 text-xs text-primary-600">{uploadSuccess}</p> : null}
        </div>
      </div>
      <div className="space-y-5 md:col-span-3">
        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <Dropdown
            value={unitStatus || 'Vacant'}
            onChange={(v) => setUnitStatus(v)}
            options={[ 'Vacant', 'Occupied', 'Inactive' ].map(v => ({ value: v, label: v }))}
            placeholder="Select status"
          />
        </div>
        {/* Unit number */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Unit Number</label>
          <Input value={unitNumber} onChange={(e)=>setUnitNumber(e.target.value)} placeholder="e.g., 10A" />
        </div>

        {/* Specifications */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Unit Specifications</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1">Bedrooms</label>
              <Dropdown value={unitBedrooms} onChange={v=>setUnitBedrooms(v)} options={BEDROOM_OPTIONS.map(v=>({ value: v, label: v }))} placeholder="Select" />
            </div>
            <div>
              <label className="block text-xs mb-1">Bathrooms</label>
              <Dropdown value={unitBathrooms} onChange={v=>setUnitBathrooms(v)} options={BATHROOM_OPTIONS.map(v=>({ value: v, label: v }))} placeholder="Select" />
            </div>
            <div>
              <label className="block text-xs mb-1">Square Feet</label>
              <Input inputMode="numeric" value={unitSize} onChange={(e)=>setUnitSize(e.target.value)} placeholder="e.g., 850" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
          <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="w-full min-h-[96px] p-3 border border-border rounded-md bg-background text-sm text-foreground" placeholder="Optional" />
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </div>
    </div>
  )

  async function onSave() {
    try {
      setSaving(true); setError(null)
      if (!unitNumber.trim()) throw new Error('Unit number is required')
      const body: Record<string, unknown> = {
        unit_number: unitNumber.trim(),
        description: notes || null,
      }
      if (unitStatus) body.status = unitStatus
      if (unitBedrooms) body.unit_bedrooms = unitBedrooms
      if (unitBathrooms) body.unit_bathrooms = unitBathrooms
      if (unitSize) body.unit_size = Number(unitSize)
      const res = await fetch(`/api/units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const payload = await parseJson<UpdateUnitResponse | Partial<UnitCardUnit>>(res, {})
      const responseObject = (payload as UpdateUnitResponse) ?? {}
      const updatedRaw = responseObject.unit ?? payload
      const updated: Partial<UnitCardUnit> | null =
        updatedRaw && typeof updatedRaw === 'object' && !('unit' in (updatedRaw as Record<string, unknown>))
          ? (updatedRaw as Partial<UnitCardUnit>)
          : responseObject.unit ?? null
      const syncError = responseObject.buildium_sync_error ?? null

      // Always reflect latest local values, even if Buildium sync failed
      if (updated) {
        setUnitNumber(updated.unit_number ?? unitNumber)
        setUnitStatus(updated.status ?? unitStatus)
        setUnitBedrooms(updated.unit_bedrooms ?? unitBedrooms)
        setUnitBathrooms(updated.unit_bathrooms ?? unitBathrooms)
        setUnitSize(
          updated.unit_size != null && !Number.isNaN(updated.unit_size)
            ? String(updated.unit_size)
            : unitSize
        )
        setNotes(updated.description ?? notes)
        if (unit && responseObject.buildium_unit_id != null) {
          unit.buildium_unit_id = responseObject.buildium_unit_id
        }
      }

      if (!res.ok) {
        throw new Error(syncError || responseObject?.error || 'Failed to update unit')
      }

      if (syncError) {
        setError(`Saved, but failed to sync to Buildium: ${syncError}`)
        return
      }

      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update unit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <InlineEditCard
      title="Unit Details"
      variant="plain"
      editing={editing}
      onEdit={() => setEditing(true)}
      onCancel={() => { setEditing(false); setError(null) }}
      onSave={onSave}
      isSaving={saving}
      canSave={Boolean(unitNumber && unitNumber.trim())}
      view={view}
      edit={edit}
    />
  )
}
