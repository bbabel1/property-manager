'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { ComplianceAssetWithRelations, ComplianceEvent } from '@/types/compliance'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

const DEVICE_CATEGORY_OPTIONS = [
  'elevator',
  'escalator',
  'dumbwaiter',
  'wheelchair_lift',
  'material_lift',
  'manlift',
  'pneumatic_elevator',
  'other_vertical',
]

const DEVICE_TECH_OPTIONS = ['traction', 'hydraulic', 'roped_hydraulic', 'mrl_traction', 'winding_drum', 'other']
const DEVICE_SUBTYPES = ['passenger', 'freight', 'dumbwaiter', 'wheelchair_lift', 'material_lift', 'manlift', 'pneumatic_elevator', 'other']
const UNSET = 'unset'

function formatDate(val?: string | null) {
  if (!val) return '—'
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? val : d.toLocaleDateString()
}

function StatusPill({ value }: { value?: string | null }) {
  if (!value) return null
  const v = value.toLowerCase()
  let className = 'bg-muted text-foreground border-muted-foreground/20'
  if (v.includes('active')) className = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (v.includes('out')) className = 'bg-amber-50 text-amber-700 border-amber-200'
  if (v.includes('retired') || v.includes('removed')) className = 'bg-slate-100 text-slate-700 border-slate-200'
  return <Badge variant="outline" className={className + ' text-xs'}>{value}</Badge>
}

function DeviceInfo({ asset }: { asset: ComplianceAssetWithRelations }) {
  const meta = (asset.metadata as Record<string, unknown> | undefined) || undefined
  const status =
    (meta?.device_status as string | undefined) ||
    (meta?.status as string | undefined) ||
    (asset as { status?: string | null })?.status
  const deviceId = asset.external_source_id || meta?.device_id || meta?.device_number
  const deviceType = asset.asset_type || meta?.device_type || 'Device'
  const filedAt = meta?.physical_address || meta?.address || meta?.filed_at || '—'
  const approvedDate = meta?.approved_date || meta?.status_date || null
  const floorFrom = meta?.travel_from_floor || meta?.floor_from || meta?.from_floor || null
  const floorTo = meta?.travel_to_floor || meta?.floor_to || meta?.to_floor || null

  const fields = [
    { label: 'Device ID', value: deviceId || '—' },
    { label: 'Device Status', value: status || '—' },
    { label: 'Device Type', value: deviceType },
    { label: 'Approved Date', value: approvedDate ? formatDate(approvedDate) : '—' },
    { label: 'Floor To', value: floorTo || '—' },
    { label: 'Floor From', value: floorFrom || '—' },
    { label: 'Filed At', value: filedAt },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Device Information</CardTitle>
        {status && <StatusPill value={status} />}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label} className="space-y-1">
              <div className="text-xs text-muted-foreground">{f.label}</div>
              <div className="text-sm font-medium break-words">{f.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FilingsTable({ events }: { events: ComplianceEvent[] }) {
  const rows = useMemo(
    () =>
      events.map((e) => {
        const raw = (e.raw_source as Record<string, unknown> | undefined) || undefined
        return {
          id: e.id,
          tracking: e.external_tracking_number || raw?.control_number || e.id,
          type: e.inspection_type || raw?.inspection_type || e.event_type,
          inspectionDate: e.inspection_date || raw?.inspection_date || null,
          defects: e.defects || raw?.defects_flag || raw?.defects || false,
          status: e.compliance_status || raw?.compliance_status,
          filedDate: e.filed_date || raw?.filed_date || null,
          externalUrl: raw?.external_url || null,
        }
      }),
    [events]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>View</TableHead>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Inspection Type</TableHead>
                <TableHead>Inspection Date</TableHead>
                <TableHead>Defects</TableHead>
                <TableHead>Compliance Status</TableHead>
                <TableHead>Filed Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    No filings or inspections for this device yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">
                    {row.externalUrl ? (
                      <a href={row.externalUrl} target="_blank" rel="noreferrer" className="underline text-primary">
                        Open
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{row.tracking}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.type || 'Inspection'}</TableCell>
                  <TableCell className="text-sm">{formatDate(row.inspectionDate)}</TableCell>
                  <TableCell className="text-sm">{row.defects ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-sm">{row.status || '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(row.filedDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ComplianceDevicePage() {
  const params = useParams()
  const router = useRouter()
  const assetId = params.assetId as string
  const propertyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [asset, setAsset] = useState<ComplianceAssetWithRelations | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<{
    device_category: string
    device_technology: string
    device_subtype: string
    is_private_residence: boolean
  }>({
    device_category: '',
    device_technology: '',
    device_subtype: '',
    is_private_residence: false,
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/compliance/assets/${assetId}`)
        if (!res.ok) throw new Error('Failed to load device')
        const data = (await res.json()) as ComplianceAssetWithRelations
        setAsset(data)
        const complianceMeta = data as {
          device_category?: string | null
          device_technology?: string | null
          device_subtype?: string | null
          is_private_residence?: boolean | null
        }
        setDraft({
          device_category: complianceMeta.device_category || '',
          device_technology: complianceMeta.device_technology || '',
          device_subtype: complianceMeta.device_subtype || '',
          is_private_residence: Boolean(complianceMeta.is_private_residence),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    if (assetId) load()
  }, [assetId])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error || 'Failed to load device'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/properties/${propertyId}/compliance/devices`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Devices
        </Button>
      </div>

      <DeviceInfo asset={asset} />

      <Card>
        <CardHeader>
          <CardTitle>Normalization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={draft.device_category || UNSET}
                onValueChange={(val) =>
                  setDraft((prev) => ({ ...prev, device_category: val === UNSET ? '' : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Unset</SelectItem>
                  {DEVICE_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Technology</Label>
              <Select
                value={draft.device_technology || UNSET}
                onValueChange={(val) =>
                  setDraft((prev) => ({ ...prev, device_technology: val === UNSET ? '' : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tech" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Unset</SelectItem>
                  {DEVICE_TECH_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subtype</Label>
              <Select
                value={draft.device_subtype || UNSET}
                onValueChange={(val) =>
                  setDraft((prev) => ({ ...prev, device_subtype: val === UNSET ? '' : val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subtype" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Unset</SelectItem>
                  {DEVICE_SUBTYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={draft.is_private_residence}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, is_private_residence: Boolean(checked) }))
                }
                id="private_residence"
              />
              <Label htmlFor="private_residence">Private residence</Label>
            </div>
          </div>
          <Button
            onClick={async () => {
              try {
                setSaving(true)
                const res = await fetch(`/api/compliance/assets/${assetId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    device_category: draft.device_category || null,
                    device_technology: draft.device_technology || null,
                    device_subtype: draft.device_subtype || null,
                    is_private_residence: draft.is_private_residence,
                  }),
                })
                const body = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(body.error || 'Failed to save device')
                setAsset((prev) => (prev ? { ...prev, ...body.asset } : prev))
                toast.success('Device normalization saved')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to save device')
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save normalization
          </Button>
        </CardContent>
      </Card>

      <FilingsTable events={asset.events || []} />
    </div>
  )
}
