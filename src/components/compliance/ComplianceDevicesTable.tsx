'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Eye, Pencil } from 'lucide-react'

type Device = {
  id: string
  name: string
  external_source_id: string | null
  asset_type?: string | null
  metadata?: Record<string, any> | null
  status?: string | null
  open_violations?: number | null
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  out_of_service: { label: 'Out of service', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  retired: { label: 'Retired', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  removed: { label: 'Retired', className: 'bg-slate-100 text-slate-700 border-slate-200' },
}

function StatusPill({ value }: { value?: string | null }) {
  if (!value) return null
  const key = value.toLowerCase()
  const info = statusLabels[key] || { label: value, className: 'bg-muted text-foreground border-muted-foreground/20' }
  return <Badge variant="outline" className={info.className + ' text-xs'}>{info.label}</Badge>
}

function formatAttr(meta: Record<string, any> | undefined | null) {
  if (!meta) return { capacity: '-', speed: '-', floors: '-' }
  const capacity = meta.elevator_capacity_lbs || meta.capacity || meta.elevator_capacity || '-' 
  const speed = meta.elevator_speed_fpm || meta.speed || '-' 
  const floors = meta.number_of_stops || meta.floors || meta.travel_to_floor || '-'
  return { capacity, speed, floors }
}

type ComplianceDevicesTableProps = {
  devices: Device[]
  propertyId?: string
}

export function ComplianceDevicesTable({ devices, propertyId }: ComplianceDevicesTableProps) {
  const [activeType, setActiveType] = useState<string>('all')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)

  const normalizedTypes = useMemo(() => {
    const counts: Record<string, number> = {}
    devices.forEach((d) => {
      const t = (d.asset_type || 'Device').toLowerCase()
      counts[t] = (counts[t] || 0) + 1
    })
    return counts
  }, [devices])

  const filteredDevices = useMemo(() => {
    if (activeType === 'all') return devices
    return devices.filter((d) => (d.asset_type || '').toLowerCase() === activeType)
  }, [devices, activeType])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Devices</h3>
      </div>
      <div className="space-y-3">
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList>
            <TabsTrigger value="all">All ({devices.length})</TabsTrigger>
            {Object.entries(normalizedTypes).map(([type, count]) => (
              <TabsTrigger key={type} value={type}>
                {type} ({count})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeType} className="mt-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DEVICE ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CAT1 Report Year</TableHead>
                    <TableHead>CAT1 Latest Report Filed</TableHead>
                    <TableHead>CAT5 Latest Report Filed</TableHead>
                    <TableHead>Periodic Latest Inspection</TableHead>
                    <TableHead>Open Violations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                        No devices found for this selection.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredDevices.map((device) => {
                    const displayId =
                      device.external_source_id ||
                      (device.name ? device.name.split(/\s+/).pop() : 'Device')
                    const isElevator = (device.asset_type || '').toLowerCase() === 'elevator'
                    const meta = device.metadata || {}
                    return (
                      <TableRow
                        key={device.id}
                        className={isElevator ? 'cursor-pointer hover:bg-muted/40' : undefined}
                        onClick={() => {
                          if (isElevator) setSelectedDevice(device)
                        }}
                      >
                        <TableCell className="font-medium">{displayId || 'Device'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{device.asset_type || 'Device'}</TableCell>
                        <TableCell><StatusPill value={device.status} /></TableCell>
                        <TableCell className="text-sm">
                          {meta.cat1_report_year || '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {meta.cat1_latest_report_filed
                            ? new Date(meta.cat1_latest_report_filed).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {meta.cat5_latest_report_filed
                            ? new Date(meta.cat5_latest_report_filed).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {meta.periodic_latest_inspection
                            ? new Date(meta.periodic_latest_inspection).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{device.open_violations ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={propertyId ? `/properties/${propertyId}/compliance/devices/${device.id}` : '#'} aria-label="View device">
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <Link href={propertyId ? `/properties/${propertyId}/compliance/devices/${device.id}` : '#'} aria-label="Edit device">
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DeviceInfoDialog device={selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)} />
    </div>
  )
}

function DeviceInfoDialog({
  device,
  onOpenChange,
}: {
  device: Device | null
  onOpenChange: (open: boolean) => void
}) {
  if (!device) return null
  const meta = device.metadata || {}

  const fields: Array<{ label: string; description: string; value: string | null }> = [
    { label: 'Device Number', description: 'The device identification number', value: meta.device_number || meta.device_id || device.external_source_id || null },
    { label: 'Device Type', description: 'The type of device group', value: meta.device_type || device.asset_type || null },
    { label: 'Device Status', description: 'The status of the device', value: meta.device_status || meta.status || device.status || null },
    { label: 'Status Date', description: 'The date of the elevator device’s current status', value: meta.status_date || null },
    { label: 'Equipment Type', description: 'The specific type of elevator equipment', value: meta.equipment_type || meta.equipmenttype || null },
    { label: 'Periodic Report Year', description: 'The year of the periodic report filing', value: meta.periodic_report_year || null },
    { label: 'CAT1 Report Year', description: 'The reporting year for the Category 1 report', value: meta.cat1_report_year || null },
    { label: 'CAT1 Latest Report Filed Date', description: 'The latest filing date of the Category 1 report', value: meta.cat1_latest_report_filed || null },
    { label: 'CAT5 Latest Report Filed Date', description: 'The latest filing date of the Category 5 report', value: meta.cat5_latest_report_filed || null },
    { label: 'Periodic Latest Inspection Date', description: 'The most recent date of inspection', value: meta.periodic_latest_inspection || null },
    { label: 'BIN', description: 'Building Identification Number assigned by Department of City Planning', value: meta.bin || null },
  ]

  const formatVal = (val: any) => {
    if (!val) return '—'
    const d = new Date(val)
    if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(String(val))) {
      return d.toLocaleDateString()
    }
    return String(val)
  }

  return (
    <Dialog open={Boolean(device)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Device Information</DialogTitle>
          <DialogDescription>Details for elevator device {fields[0].value || ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.label} className="flex justify-between gap-4 border-b pb-2">
              <div>
                <div className="text-sm font-semibold">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.description}</div>
              </div>
              <div className="text-sm text-right min-w-[160px] break-words">{formatVal(f.value)}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
