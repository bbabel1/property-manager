"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { PageShell, PageHeader, PageBody, Stack } from '@/components/layout/page-shell'
import { Separator } from '@/components/ui/separator'
import { DEVICE_CATEGORY_OPTIONS } from '@/lib/compliance-programs'

type ProgramCriteria = {
  scope_override?: 'property' | 'asset' | 'both'
  property_filters?: {
    boroughs?: string[]
    require_bin?: boolean
  }
  asset_filters?: {
    asset_types?: string[]
    external_source?: string | null
    active_only?: boolean
    device_categories?: string[]
    exclude_device_categories?: string[]
  }
}

type Program = {
  id: string
  org_id: string
  template_id: string | null
  code: string
  name: string
  jurisdiction: string
  frequency_months: number
  lead_time_days: number
  applies_to: 'property' | 'asset' | 'both'
  severity_score: number
  is_enabled: boolean
  criteria?: ProgramCriteria | null
  notes: string | null
  override_fields?: Record<string, unknown> | null
  template?: {
    code: string
    name: string
    jurisdiction: string
    frequency_months: number
    lead_time_days: number
    applies_to: 'property' | 'asset' | 'both'
    severity_score: number
  }
}

const JURISDICTION_LABEL: Record<string, string> = {
  NYC_DOB: 'DOB',
  NYC_HPD: 'HPD',
  FDNY: 'FDNY',
  NYC_DEP: 'DEP',
  OTHER: 'Other',
}

const ELEVATOR_DUE_BY_CODE: Record<string, string> = {
  NYC_ELV_PERIODIC: 'Inspection Jan 1–Dec 31; file within 14 days (late after Jan 14).',
  NYC_ELV_CAT1: 'Test Jan 1–Dec 31; file within 21 days (late after Jan 21).',
  NYC_ELV_CAT5: 'Within 5 years of prior CAT5/new C of C; file within 21 days and by 21st of month after anniversary.',
}

const ELEVATOR_FREQUENCY_BY_CODE: Record<string, string> = {
  NYC_ELV_PERIODIC: 'Annual visual inspection by approved elevator agency',
  NYC_ELV_CAT1: 'Annual (no-load) safety test',
  NYC_ELV_CAT5: 'Every 5 years full-load safety test',
}

export default function ComplianceProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [criteriaDraft, setCriteriaDraft] = useState<ProgramCriteria>({})
  const [savingCriteria, setSavingCriteria] = useState(false)
  const [previewResult, setPreviewResult] = useState<{ matched_properties: number; matched_assets: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [generatePreview, setGeneratePreview] = useState<{ program: Program | null; result: { matched_properties: number; matched_assets: number; total_properties: number; total_assets: number } | null }>({ program: null, result: null })
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [programDraft, setProgramDraft] = useState<{
    jurisdiction: string
    applies_to: Program['applies_to']
    frequency_months: number
    lead_time_days: number
    notes: string
    due_date_text: string
    frequency_text: string
  } | null>(null)

  const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
  const ASSET_TYPES = ['elevator', 'boiler', 'sprinkler', 'gas_piping', 'facade', 'generic', 'other']
  const DEVICE_CATEGORIES = DEVICE_CATEGORY_OPTIONS

  const loadPrograms = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/compliance/programs')
      if (!res.ok) throw new Error('Failed to load programs')
      const data = await res.json()
      setPrograms(data.programs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  const openCriteriaEditor = (program: Program) => {
    const propertyFilters = program.criteria?.property_filters || {}
    const assetFilters = program.criteria?.asset_filters || {}
    const override = program.override_fields || {}
    const defaultDue = ELEVATOR_DUE_BY_CODE[program.code] || ''
    const defaultFreqText = ELEVATOR_FREQUENCY_BY_CODE[program.code] || ''
    setProgramDraft({
      jurisdiction: program.jurisdiction,
      applies_to: program.applies_to,
      frequency_months: program.frequency_months,
      lead_time_days: program.lead_time_days,
      notes: program.notes || '',
      due_date_text: (override?.due_date_text as string) || defaultDue,
      frequency_text: (override?.frequency_text as string) || defaultFreqText,
    })
    setEditingProgram(program)
    setPreviewResult(null)
    setCriteriaDraft({
      scope_override: program.criteria?.scope_override,
      property_filters: {
        boroughs: propertyFilters.boroughs || [],
        require_bin: propertyFilters.require_bin,
      },
      asset_filters: {
        asset_types: assetFilters.asset_types || [],
        external_source: assetFilters.external_source || '',
        active_only: assetFilters.active_only,
        device_categories: assetFilters.device_categories || [],
        exclude_device_categories: assetFilters.exclude_device_categories || [],
      },
    })
  }

  const buildCriteriaPayload = (): ProgramCriteria | {} => {
    const payload: ProgramCriteria = {}
    if (criteriaDraft.scope_override) payload.scope_override = criteriaDraft.scope_override

    const pf: ProgramCriteria['property_filters'] = {}
    if (criteriaDraft.property_filters?.boroughs && criteriaDraft.property_filters.boroughs.length > 0) {
      pf.boroughs = criteriaDraft.property_filters.boroughs
    }
    if (typeof criteriaDraft.property_filters?.require_bin === 'boolean') {
      pf.require_bin = criteriaDraft.property_filters.require_bin
    }
    if (pf && Object.keys(pf).length > 0) payload.property_filters = pf

    const af: ProgramCriteria['asset_filters'] = {}
    if (criteriaDraft.asset_filters?.asset_types && criteriaDraft.asset_filters.asset_types.length > 0) {
      af.asset_types = criteriaDraft.asset_filters.asset_types
    }
    if (typeof criteriaDraft.asset_filters?.external_source === 'string') {
      const trimmed = criteriaDraft.asset_filters.external_source.trim()
      if (trimmed.length > 0) af.external_source = trimmed
    }
    if (typeof criteriaDraft.asset_filters?.active_only === 'boolean') {
      af.active_only = criteriaDraft.asset_filters.active_only
    }
    if (criteriaDraft.asset_filters?.device_categories && criteriaDraft.asset_filters.device_categories.length > 0) {
      af.device_categories = criteriaDraft.asset_filters.device_categories
    }
    if (
      criteriaDraft.asset_filters?.exclude_device_categories &&
      criteriaDraft.asset_filters.exclude_device_categories.length > 0
    ) {
      af.exclude_device_categories = criteriaDraft.asset_filters.exclude_device_categories
    }
    if (af && Object.keys(af).length > 0) payload.asset_filters = af

    return Object.keys(payload).length > 0 ? payload : {}
  }

  const saveCriteria = async () => {
    if (!editingProgram) return
    const fallback = editingProgram
    try {
      setSavingCriteria(true)
      const payload = {
        criteria: buildCriteriaPayload(),
        jurisdiction: programDraft?.jurisdiction || fallback.jurisdiction,
        applies_to: programDraft?.applies_to || fallback.applies_to,
        frequency_months:
          typeof programDraft?.frequency_months === 'number'
            ? programDraft.frequency_months
            : fallback.frequency_months,
        lead_time_days:
          typeof programDraft?.lead_time_days === 'number'
            ? programDraft.lead_time_days
            : fallback.lead_time_days,
        notes: programDraft?.notes ?? fallback.notes ?? '',
        override_fields: {
          ...(editingProgram.override_fields || {}),
          due_date_text: programDraft?.due_date_text || null,
          frequency_text: programDraft?.frequency_text || null,
        },
      }
      const res = await fetch(`/api/compliance/programs/${editingProgram.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update criteria')
      setPrograms((prev) => prev.map((p) => (p.id === editingProgram.id ? { ...p, ...data.program } : p)))
      toast.success('Criteria saved')
      setEditingProgram(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update criteria')
    } finally {
      setSavingCriteria(false)
    }
  }

  const previewCriteria = async () => {
    if (!editingProgram) return
    try {
      setPreviewLoading(true)
      const res = await fetch(`/api/compliance/programs/${editingProgram.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: buildCriteriaPayload() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to preview criteria')
      setPreviewResult({ matched_properties: data.matched_properties, matched_assets: data.matched_assets })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to preview criteria')
    } finally {
      setPreviewLoading(false)
    }
  }

  const toggleArrayValue = (list: string[] | undefined, value: string, nextChecked: boolean) => {
    const set = new Set(list || [])
    if (nextChecked) set.add(value)
    else set.delete(value)
    return Array.from(set)
  }
  const formatCategoryLabel = (category: string) =>
    category
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

  const formatAssetTypeLabel = (type: string) =>
    type
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

  const criteriaSummary = (program: Program) => {
    const parts: string[] = []
    const scope = program.criteria?.scope_override || program.applies_to
    parts.push(scope === 'asset' ? 'Asset scope' : scope === 'property' ? 'Property scope' : 'Property & asset scope')
    if (program.criteria?.asset_filters?.asset_types?.length) {
      parts.push(`Assets: ${program.criteria.asset_filters.asset_types.join(', ')}`)
    }
    if (program.criteria?.asset_filters?.device_categories?.length) {
      parts.push(
        `Devices: ${program.criteria.asset_filters.device_categories.map((c) => formatCategoryLabel(c)).join(', ')}`
      )
    }
    if (program.criteria?.asset_filters?.exclude_device_categories?.length) {
      parts.push(
        `Exclude: ${program.criteria.asset_filters.exclude_device_categories
          .map((c) => formatCategoryLabel(c))
          .join(', ')}`
      )
    }
    if (program.criteria?.property_filters?.boroughs?.length) {
      parts.push(`Boroughs: ${program.criteria.property_filters.boroughs.join(', ')}`)
    }
    if (program.criteria?.property_filters?.require_bin) parts.push('BIN required')
    if (program.criteria?.asset_filters?.active_only) parts.push('Active assets only')
    return parts.length ? parts.join(' • ') : 'Applies broadly (no filters set)'
  }

  const toggleProgram = async (programId: string, nextEnabled: boolean) => {
    try {
      const res = await fetch(`/api/compliance/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: nextEnabled }),
      })
      if (!res.ok) throw new Error('Failed to update program')
      const data = await res.json()
      setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, ...data.program } : p)))
      toast.success(`Program ${nextEnabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update program')
    }
  }

  const generateItems = async (programId: string) => {
    try {
      setGeneratingId(programId)
      const res = await fetch(`/api/compliance/programs/${programId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periods_ahead: 12 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate items')

      toast.success('Compliance items generated', {
        description: `Created ${data.items_created}, skipped ${data.items_skipped}`,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate items')
    } finally {
      setGeneratingId(null)
    }
  }

  const previewGeneration = async (program: Program) => {
    try {
      setGenerateError(null)
      setGeneratePreview({ program, result: null })
      setGenerateLoading(true)
      const res = await fetch(`/api/compliance/programs/${program.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: program.criteria || {} }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to preview generation')
      setGeneratePreview({ program, result: data })
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to preview generation')
    } finally {
      setGenerateLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Compliance Programs" />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Compliance Programs" />
        <PageBody>
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Error: {error}</p>
            <Button onClick={loadPrograms} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </PageBody>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title="Compliance Programs" />
      <PageBody>
        <Stack gap="lg">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div><strong>Programs</strong> are the rulebooks (NYC DOB/HPD/FDNY requirements).</div>
              <div><strong>Items</strong> are the generated reminders/todos per building or asset.</div>
              <div><strong>Events</strong> are real-world inspections and filings pulled from NYC data.</div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {programs.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No compliance programs found. If this seems wrong, refresh or check seeding/permissions.
                </CardContent>
              </Card>
            )}
            {programs.map((program) => (
              <Card key={program.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {program.name}
                      <Badge variant="outline">{program.jurisdiction}</Badge>
                      <Badge variant="outline">{program.applies_to === 'asset' ? 'Asset' : 'Property'} scope</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{program.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {program.frequency_months > 0
                        ? `Every ${program.frequency_months} month(s); lead time ${program.lead_time_days} days`
                        : 'Per defect / ad-hoc schedule'}; severity {program.severity_score}/5
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={program.is_enabled}
                      onCheckedChange={(checked) => toggleProgram(program.id, checked)}
                    />
                    <Badge variant={program.is_enabled ? 'outline' : 'secondary'}>
                      {program.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {program.is_enabled ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>
                      {program.is_enabled
                        ? 'New items will be generated for applicable buildings/assets.'
                        : 'Items will not be generated until enabled.'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Criteria: </span>
                    {criteriaSummary(program)}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => openCriteriaEditor(program)}>
                      Edit criteria
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generatingId === program.id}
                      onClick={() => previewGeneration(program)}
                    >
                      {generatingId === program.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Generate items
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Stack>
      </PageBody>

      <Dialog open={!!editingProgram} onOpenChange={(open) => (open ? null : setEditingProgram(null))}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit applicability</DialogTitle>
            <DialogDescription>
              Choose which properties or assets this program should target before generating items.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={programDraft?.jurisdiction || editingProgram?.jurisdiction || 'NYC_DOB'}
                  onValueChange={(value) =>
                    setProgramDraft((prev) =>
                      prev
                        ? { ...prev, jurisdiction: value }
                        : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(JURISDICTION_LABEL).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Applicability scope</Label>
                <Select
                  value={programDraft?.applies_to || editingProgram?.applies_to || 'asset'}
                  onValueChange={(value) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, applies_to: value as Program['applies_to'] } : prev
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Per device</SelectItem>
                    <SelectItem value="property">Per property</SelectItem>
                    <SelectItem value="both">Property & device</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequency (months)</Label>
                <Input
                  type="number"
                  min={0}
                  value={programDraft?.frequency_months ?? editingProgram?.frequency_months ?? 0}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, frequency_months: Number(e.target.value || 0) } : prev
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Lead time (days before period end)</Label>
                <Input
                  type="number"
                  min={0}
                  value={programDraft?.lead_time_days ?? editingProgram?.lead_time_days ?? 0}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, lead_time_days: Number(e.target.value || 0) } : prev
                    )
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Frequency description (what needs to happen)</Label>
                <Textarea
                  rows={2}
                  value={programDraft?.frequency_text ?? editingProgram?.frequency_text ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, frequency_text: e.target.value } : prev
                    )
                  }
                  placeholder="e.g., Annual visual inspection by approved elevator agency"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Due date</Label>
                <Textarea
                  rows={2}
                  value={programDraft?.due_date_text ?? editingProgram?.due_date_text ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, due_date_text: e.target.value } : prev
                    )
                  }
                  placeholder="e.g., Inspection Jan 1–Dec 31; file within 14 days; late after Jan 14 not accepted"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={programDraft?.notes ?? ''}
                  onChange={(e) =>
                    setProgramDraft((prev) =>
                      prev ? { ...prev, notes: e.target.value } : prev
                    )
                  }
                  placeholder="Add program notes/penalties"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Property filters</h3>
                  <div className="space-y-2">
                    {BOROUGHS.map((borough) => (
                      <div key={borough} className="flex items-center space-x-2">
                        <Checkbox
                          id={`borough-${borough}`}
                          checked={criteriaDraft.property_filters?.boroughs?.includes(borough) || false}
                          onCheckedChange={(checked) =>
                            setCriteriaDraft((prev) => ({
                              ...prev,
                              property_filters: {
                                ...prev.property_filters,
                                boroughs: toggleArrayValue(prev.property_filters?.boroughs, borough, Boolean(checked)),
                              },
                            }))
                          }
                        />
                        <Label htmlFor={`borough-${borough}`} className="text-sm whitespace-nowrap">
                          {borough}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Asset filters</h3>
                  <div className="space-y-2">
                    {ASSET_TYPES.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`asset-${type}`}
                          checked={criteriaDraft.asset_filters?.asset_types?.includes(type) || false}
                          onCheckedChange={(checked) =>
                            setCriteriaDraft((prev) => ({
                              ...prev,
                              asset_filters: {
                                ...prev.asset_filters,
                                asset_types: toggleArrayValue(prev.asset_filters?.asset_types, type, Boolean(checked)),
                              },
                            }))
                          }
                        />
                        <Label htmlFor={`asset-${type}`} className="text-sm whitespace-nowrap">
                          {formatAssetTypeLabel(type)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Device categories (vertical transport)</h3>
                  <div className="space-y-2">
                    {DEVICE_CATEGORIES.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={criteriaDraft.asset_filters?.device_categories?.includes(category) || false}
                          onCheckedChange={(checked) =>
                            setCriteriaDraft((prev) => ({
                              ...prev,
                              asset_filters: {
                                ...prev.asset_filters,
                                device_categories: toggleArrayValue(
                                  prev.asset_filters?.device_categories,
                                  category,
                                  Boolean(checked)
                                ),
                              },
                            }))
                          }
                        />
                        <Label htmlFor={`category-${category}`} className="text-sm whitespace-nowrap">
                          {formatCategoryLabel(category)}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target specific DOB-regulated device classes (e.g., elevators vs escalators).
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Exclude categories</h3>
                  <div className="space-y-2">
                    {DEVICE_CATEGORIES.map((category) => (
                      <div key={`exclude-${category}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`exclude-${category}`}
                          checked={criteriaDraft.asset_filters?.exclude_device_categories?.includes(category) || false}
                          onCheckedChange={(checked) =>
                            setCriteriaDraft((prev) => ({
                              ...prev,
                              asset_filters: {
                                ...prev.asset_filters,
                                exclude_device_categories: toggleArrayValue(
                                  prev.asset_filters?.exclude_device_categories,
                                  category,
                                  Boolean(checked)
                                ),
                              },
                            }))
                          }
                        />
                        <Label htmlFor={`exclude-${category}`} className="text-sm whitespace-nowrap">
                          {formatCategoryLabel(category)}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Skip exempt device classes without disabling the program.</p>
                </div>
              </div>
            </div>

            {previewResult && (
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium text-foreground mb-1">Preview</div>
                <div className="text-muted-foreground">
                  Matches {previewResult.matched_properties} properties and {previewResult.matched_assets} assets.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={previewCriteria} disabled={previewLoading}>
              {previewLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Preview targets
            </Button>
            <Button onClick={saveCriteria} disabled={savingCriteria}>
              {savingCriteria && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save criteria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!generatePreview.program}
        onOpenChange={(open) => (open ? null : setGeneratePreview({ program: null, result: null }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate items</DialogTitle>
            <DialogDescription>
              Preview how many properties/assets this will target before creating items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {generateError && (
              <div className="text-sm text-destructive border border-destructive/30 rounded-md p-2">
                {generateError}
              </div>
            )}
            <div className="rounded-md border p-3 text-sm">
              {generateLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preview...
                </div>
              )}
              {!generateLoading && generatePreview.result && (
                <div className="space-y-1 text-muted-foreground">
                  <div>
                    <span className="text-foreground font-medium">Matches</span>{' '}
                    {generatePreview.result.matched_properties} properties / {generatePreview.result.matched_assets} assets
                  </div>
                  <div className="text-xs">
                    Total available: {generatePreview.result.total_properties} properties / {generatePreview.result.total_assets} assets
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setGeneratePreview({ program: null, result: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!generatePreview.program) return
                setGeneratePreview({ program: null, result: null })
                generateItems(generatePreview.program.id)
              }}
              disabled={generateLoading || !!generateError}
            >
              Generate now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
