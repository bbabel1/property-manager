'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ComplianceSummaryHeader } from '@/components/compliance/ComplianceSummaryHeader'
import { ComplianceAgencyCards } from '@/components/compliance/ComplianceAgencyCards'
import { ComplianceChecklistTable } from '@/components/compliance/ComplianceChecklistTable'
import { ViolationsList } from '@/components/compliance/ViolationsList'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  LargeDialogContent,
} from '@/components/ui/dialog'
import { PageBody, Stack } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, RefreshCw } from 'lucide-react'
import type {
  ComplianceItemWithRelations,
  ComplianceViolationWithRelations,
  ComplianceAsset,
  ComplianceProgram,
  CompliancePropertyProgramOverride,
} from '@/types/compliance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ComplianceDevicesTable } from '@/components/compliance/ComplianceDevicesTable'
import { toast } from 'sonner'

interface PropertyComplianceData {
  property: {
    id: string
    name: string
    address_line1: string
    borough: string | null
    bin: string | null
    building_id?: string | null
    total_units?: number | null
  }
  building?: {
    id: string
    occupancy_group: string | null
    occupancy_description: string | null
    is_one_two_family: boolean | null
    is_private_residence_building: boolean | null
    dwelling_unit_count: number | null
  } | null
  items: ComplianceItemWithRelations[]
  violations: ComplianceViolationWithRelations[]
  assets: (ComplianceAsset & {
    device_category?: string | null
    device_technology?: string | null
    device_subtype?: string | null
    is_private_residence?: boolean | null
    next_due?: string | null
    last_inspection_at?: string | null
  })[]
  programs: Array<
    ComplianceProgram & {
      override?: CompliancePropertyProgramOverride | null
      effective_is_enabled?: boolean
    }
  >
  events: Array<{
    id: string
    asset_id?: string | null
    inspection_date: string | null
    filed_date: string | null
    event_type: string
    inspection_type: string | null
    compliance_status: string | null
    external_tracking_number?: string | null
    created_at: string
  }>
  kpis?: {
    devices: number
    open_violations: number
    next_due: string | null
    last_sync: string | null
    status_chip: 'on_track' | 'at_risk' | 'non_compliant'
  }
  agencies?: {
    hpd: { registration_id: string | null; building_id: string | null; violations: number; complaints: number; last_event_date: string | null }
    fdny: { open_violations: number; last_event_date: string | null }
    dep: { open_violations: number; last_event_date: string | null }
  }
  timeline?: Array<{ type: 'event' | 'violation'; date: string; title: string | null; status?: string | null; agency?: string | null }>
  summary: {
    open_violations: number
    overdue_items: number
    items_due_next_30_days: number
  }
}

export default function PropertyCompliancePage() {
  const params = useParams()
  const propertyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PropertyComplianceData | null>(null)
  const [savingProgramId, setSavingProgramId] = useState<string | null>(null)
  const [programsDialogOpen, setProgramsDialogOpen] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/compliance/properties/${propertyId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch compliance data')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch property compliance data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (propertyId) {
      fetchData()
    }
  }, [propertyId])

  const handleViewItem = (itemId: string) => {
    // TODO: Open compliance item detail modal
    console.log('View item:', itemId)
  }

  type PropertyProgram = PropertyComplianceData['programs'][number]

  const programIsEnabled = (program: PropertyProgram): boolean => {
    if (typeof program.effective_is_enabled === 'boolean') {
      return program.effective_is_enabled
    }
    return Boolean(program.is_enabled)
  }

  const displayProgramName = (program: { code?: string | null; name?: string | null }) => {
    const code = program.code || ''
    if (code === 'NYC_ELV_CAT1') return 'Elevator (CAT1)'
    if (code === 'NYC_ELV_CAT5') return 'Elevator (CAT5)'
    return program.name || code || 'Program'
  }

  const formatProgramFrequency = (program: PropertyProgram) => {
    if (program.frequency_months === 60) return 'Every 5 years'
    if (program.frequency_months === 12) return 'Annual'
    return `${program.frequency_months}-month cycle`
  }

  const formatProgramDue = (program: PropertyProgram) => {
    if (program.code === 'NYC_ELV_PERIODIC') {
      return 'Inspect Jan 1–Dec 31; file within 14 days'
    }
    if (program.code === 'NYC_ELV_CAT1') {
      return 'Test Jan 1–Dec 31; file within 21 days'
    }
    if (program.code === 'NYC_ELV_CAT5') {
      return 'Within 5 years of last CAT5; file within 21 days'
    }
    return `Lead time ${program.lead_time_days} day(s) before period end`
  }

  const updateProgramOverride = async (program: PropertyProgram, isEnabled: boolean) => {
    try {
      setSavingProgramId(program.id)
      const res = await fetch(`/api/compliance/properties/${propertyId}/programs/${program.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: isEnabled }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to update program')

      setData((prev) =>
        prev
          ? {
              ...prev,
              programs: prev.programs.map((p) =>
                p.id === program.id
                  ? {
                      ...p,
                      override: body.override || null,
                      effective_is_enabled:
                        typeof body.effective_is_enabled === 'boolean' ? body.effective_is_enabled : Boolean(isEnabled),
                    }
                  : p
              ),
            }
          : prev
      )
      toast.success('Program override updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update program override')
    } finally {
      setSavingProgramId(null)
    }
  }

  if (loading) {
    return (
      <PageBody>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageBody>
    )
  }

  if (error || !data) {
    return (
      <PageBody>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Error: {error || 'Failed to load compliance data'}</p>
          <Button onClick={fetchData} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        </div>
      </PageBody>
    )
  }

  // Derived UI data
  const assetMap = new Map<string, ComplianceAsset>()
  data?.assets.forEach((a) => {
    if (a.id) assetMap.set(a.id, a)
  })

  const devices = (data?.assets || [])
    .map((a) => {
      const meta = (a as any)?.metadata as Record<string, any> | null
      return {
        id: a.id,
        name: a.name || a.external_source_id || 'Device',
        external_source_id: a.external_source_id || null,
        asset_type: a.asset_type || (meta?.device_type as string | null) || 'Device',
        metadata: meta,
        status: (meta?.device_status as string | null) || (meta?.status as string | null) || undefined,
        last_inspection: ((a as any).last_inspection_at as string | null) || null,
        next_due: ((a as any).next_due as string | null) || null,
        open_violations: 0,
      }
    })
    .filter((d) => Boolean(d.status))

  const deviceCount = devices.length

  const deviceById: Record<string, any> = {}
  devices.forEach((d) => {
    deviceById[d.id] = d
  })

  // Filter compliance items to only those whose asset is in the displayed devices list (or property-scoped items with no asset)
  const filteredItems = (data.items || []).filter((item) => {
    if (!item.asset_id) return true
    return Boolean(deviceById[item.asset_id])
  })

  // Deduplicate so each program appears only once per asset/property (keep the soonest due)
  const itemsForDisplay = Array.from(
    filteredItems.reduce((acc, item) => {
      const key = `${item.program_id}-${item.asset_id || 'property'}`
      const existing = acc.get(key)
      if (!existing) {
        acc.set(key, item)
      } else {
        const existingDue = new Date(existing.due_date).getTime()
        const incomingDue = new Date(item.due_date).getTime()
        if (!Number.isNaN(incomingDue) && (Number.isNaN(existingDue) || incomingDue < existingDue)) {
          acc.set(key, item)
        }
      }
      return acc
    }, new Map<string, (typeof filteredItems)[number]>()).values()
  ).map((item) => {
    const device = item.asset_id ? deviceById[item.asset_id] : null
    const meta = device?.metadata || {}

    let lastEventDate: string | null = null
    if (item.program?.code === 'NYC_ELV_CAT1') {
      lastEventDate =
        meta.cat1_latest_report_filed ||
        meta.cat1_report_year ||
        device?.last_inspection ||
        null
    } else if (item.program?.code === 'NYC_ELV_CAT5') {
      lastEventDate =
        meta.cat5_latest_report_filed ||
        device?.last_inspection ||
        null
    } else {
      lastEventDate = device?.last_inspection || null
    }

    return {
      ...item,
      programDisplayName: displayProgramName(item.program || { code: item.program_id, name: item.program?.name }),
      computedLastInspection: lastEventDate,
      computedLastEventType:
        item.program?.code === 'NYC_ELV_CAT1'
          ? 'CAT1'
          : item.program?.code === 'NYC_ELV_CAT5'
            ? 'CAT5'
            : item.events?.[0]?.inspection_type || item.events?.[0]?.event_type || null,
    }
  })

  // Map events to update device last_inspection for summary table
  data?.events.forEach((e) => {
    if (e.asset_id && deviceById[e.asset_id] && e.inspection_date) {
      const existing = deviceById[e.asset_id].last_inspection
      if (!existing || new Date(e.inspection_date) > new Date(existing)) {
        deviceById[e.asset_id].last_inspection = e.inspection_date
      }
    }
  })

  const violationsPanel =
    data?.violations.map((v) => {
      const device = v.asset_id ? deviceById[v.asset_id]?.name || deviceById[v.asset_id]?.external_source_id : null
      if (v.asset_id && deviceById[v.asset_id] && (v.status === 'open' || v.status === 'in_progress')) {
        deviceById[v.asset_id].open_violations = (deviceById[v.asset_id].open_violations || 0) + 1
      }
      return {
        id: v.id,
        violation_number: v.violation_number,
        agency: v.agency || 'DOB',
        device,
        issue_date: v.issue_date,
        status: v.status,
        description: v.description,
      }
    }) || []

  const kpis = data?.kpis || {
    devices: deviceCount || 0,
    open_violations: data?.summary.open_violations || 0,
    next_due: null,
    last_sync: null,
    status_chip: 'on_track' as const,
  }

  const propertyPrograms = [...(data?.programs || [])].sort((a, b) => {
    const aName = displayProgramName(a)
    const bName = displayProgramName(b)
    return aName.localeCompare(bName)
  })

  return (
    <PageBody>
      <Stack gap="lg">
        <Dialog open={programsDialogOpen} onOpenChange={setProgramsDialogOpen}>
          <ComplianceSummaryHeader
            propertyName={data.property.name}
            addressLine1={data.property.address_line1}
            jurisdiction="NYC – DOB / HPD / FDNY"
            status={kpis.status_chip}
            kpis={[
              { label: 'Devices', value: String(kpis.devices) },
              { label: 'Open Violations', value: String(kpis.open_violations) },
              { label: 'Next Due', value: kpis.next_due ? new Date(kpis.next_due).toLocaleDateString() : '—' },
              { label: 'Last Sync', value: kpis.last_sync ? new Date(kpis.last_sync).toLocaleString() : '—' },
            ]}
            actions={
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Programs
                </Button>
              </DialogTrigger>
            }
          />

          <LargeDialogContent>
            <div className="p-6 space-y-4">
              <DialogHeader className="items-start">
                <DialogTitle>Programs for this property</DialogTitle>
                <DialogDescription>Starts from org defaults. Toggle on/off here.</DialogDescription>
              </DialogHeader>

              {propertyPrograms.length === 0 ? (
                <p className="text-sm text-muted-foreground">No programs for this property.</p>
              ) : (
                <ScrollArea className="max-h-[70vh] pr-2">
                  <div className="divide-y rounded-lg border">
                    {propertyPrograms.map((program) => {
                      const orgDefault = program.is_enabled ? 'On' : 'Off'
                      const enabled = programIsEnabled(program)

                      return (
                        <div
                          key={program.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium leading-none">{displayProgramName(program)}</p>
                              <Badge variant={program.effective_is_enabled ? 'default' : 'secondary'}>
                                {program.effective_is_enabled ? 'On for this property' : 'Off for this property'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {program.jurisdiction || 'Program'} • {formatProgramFrequency(program)}
                            </p>
                            <p className="text-sm text-muted-foreground">{formatProgramDue(program)}</p>
                            <p className="text-xs text-muted-foreground">Org default: {orgDefault}</p>
                          </div>

                          <div className="flex items-center gap-3 sm:min-w-[260px]">
                            {savingProgramId === program.id && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`program-${program.id}`}
                                checked={enabled}
                                onCheckedChange={(checked) => updateProgramOverride(program, Boolean(checked))}
                                disabled={Boolean(savingProgramId)}
                              />
                              <Label htmlFor={`program-${program.id}`} className="text-sm">
                                {enabled ? 'On for this property' : 'Off for this property'}
                              </Label>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </LargeDialogContent>
        </Dialog>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="space-y-4 xl:col-span-2">
            <ComplianceDevicesTable devices={devices} propertyId={propertyId} />

            <Tabs defaultValue="checklist" className="space-y-4">
              <TabsList>
                <TabsTrigger value="checklist">Compliance Checklist</TabsTrigger>
                <TabsTrigger value="violations">Violations</TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="space-y-4">
                <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Compliance Items</h3>
                  </div>
                  <CollapsibleContent className="pt-2">
                    <ComplianceChecklistTable items={itemsForDisplay} onViewItem={handleViewItem} />
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              <TabsContent value="violations" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Violations (detailed)</h3>
                  <Button onClick={fetchData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <ViolationsList violations={data.violations} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <ComplianceAgencyCards
              hpd={data.agencies?.hpd || { registration_id: null, building_id: null, violations: 0, complaints: 0, last_event_date: null }}
              fdny={data.agencies?.fdny || { open_violations: 0, last_event_date: null }}
              dep={data.agencies?.dep || { open_violations: 0, last_event_date: null }}
            />
          </div>
        </div>
      </Stack>
    </PageBody>
  )
}
