'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react'
import type { ComplianceAsset } from '@/types/compliance'

type DeviceRow = {
  id: string
  name: string
  asset_type?: string | null
  status?: string | null
  last_inspection?: string | null
  next_due?: string | null
}

function StatusPill({ value }: { value?: string | null }) {
  if (!value) return null
  const key = value.toLowerCase()
  const className =
    key.includes('active')
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : key.includes('out')
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : key.includes('retired') || key.includes('removed')
      ? 'bg-slate-100 text-slate-700 border-slate-200'
      : 'bg-muted text-foreground border-muted-foreground/20'
  return (
    <Badge variant="outline" className={className + ' text-xs'}>
      {value}
    </Badge>
  )
}

export default function PropertyDevicesPage() {
  const params = useParams()
  const router = useRouter()
  const propertyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [propertyName, setPropertyName] = useState<string>('')
  const [devices, setDevices] = useState<DeviceRow[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/compliance/properties/${propertyId}`)
        if (!res.ok) throw new Error('Failed to load property devices')
        const data = await res.json()
        setPropertyName(data?.property?.name || 'Property')
        const rows =
        (data?.assets as ComplianceAsset[] | undefined)?.map((a) => {
          const meta = (a?.metadata as Record<string, unknown> | null) || null
          return {
            id: String(a.id ?? a.external_source_id ?? 'device'),
            name: a.name || a.external_source_id || 'Device',
            asset_type: a.asset_type || meta?.device_type || null,
            status: typeof meta?.device_status === 'string'
              ? meta.device_status
              : typeof meta?.status === 'string'
                ? meta.status
                : null,
            last_inspection: (a as { last_inspection_at?: string | null })?.last_inspection_at || null,
            next_due: (a as { next_due?: string | null })?.next_due || null,
          }
        }) || []
        setDevices(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    if (propertyId) load()
  }, [propertyId])

  const formatted = useMemo(
    () =>
      devices.map((d) => ({
        ...d,
        last_inspection: d.last_inspection ? new Date(d.last_inspection).toLocaleDateString() : '—',
        next_due: d.next_due ? new Date(d.next_due).toLocaleDateString() : '—',
      })),
    [devices],
  )

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/properties/${propertyId}/compliance`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Compliance
        </Button>
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Devices</h1>
          <p className="text-sm text-muted-foreground">Manage compliance devices for {propertyName}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/properties/${propertyId}/compliance`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Compliance
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Inspection</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead className="w-[140px]">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formatted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      No devices found.
                    </TableCell>
                  </TableRow>
                )}
                {formatted.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{device.asset_type || '—'}</TableCell>
                    <TableCell><StatusPill value={device.status} /></TableCell>
                    <TableCell className="text-sm">{device.last_inspection}</TableCell>
                    <TableCell className="text-sm">{device.next_due}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/properties/${propertyId}/compliance/devices/${device.id}`}>
                          View / edit
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
