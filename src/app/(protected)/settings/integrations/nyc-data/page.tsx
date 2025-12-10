"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Database, Eye, EyeOff, ShieldCheck } from 'lucide-react'

type DatasetKey =
  | 'elevatorDevices'
  | 'elevatorInspections'
  | 'elevatorViolations'
  | 'dobViolations'
  | 'dobActiveViolations'
  | 'dobEcbViolations'
  | 'hpdViolations'
  | 'hpdComplaints'
  | 'fdnyViolations'
  | 'asbestosViolations'

type DatasetMeta = {
  key: DatasetKey
  title: string
  defaultId: string
  description: string
}

const nycDatasets: DatasetMeta[] = [
  {
    key: 'elevatorDevices',
    title: 'Elevator Devices (Open Data)',
    defaultId: 'juyv-2jek',
    description: 'Authoritative device master: device_number, BIN, type, status.',
  },
  {
    key: 'elevatorInspections',
    title: 'Elevator Inspections/Tests',
    defaultId: 'e5aq-a4j2',
    description: 'Inspection/test history (CAT1/CAT5), dates, outcomes.',
  },
  {
    key: 'elevatorViolations',
    title: 'Elevator Violations',
    defaultId: 'rff7-h44d',
    description: 'Elevator-specific violations keyed by device_number and BIN.',
  },
  {
    key: 'dobViolations',
    title: 'DOB Violations (BIS – full)',
    defaultId: '3h2n-5cm9',
    description: 'Complete DOB violation history for BIN.',
  },
  {
    key: 'dobActiveViolations',
    title: 'Active DOB Violations',
    defaultId: '6drr-tyq2',
    description: 'Open DOB violations subset for BIN.',
  },
  {
    key: 'dobEcbViolations',
    title: 'DOB ECB / OATH Violations',
    defaultId: '6bgk-3dad',
    description: 'ECB summons tied to DOB enforcement.',
  },
  {
    key: 'hpdViolations',
    title: 'HPD Violations',
    defaultId: 'wvxf-dwi5',
    description: 'HPD Housing Maintenance Code violations.',
  },
  {
    key: 'hpdComplaints',
    title: 'HPD Complaints / Problems',
    defaultId: 'ygpa-z7cr',
    description: 'HPD complaints/problems (precursors to violations).',
  },
  {
    key: 'fdnyViolations',
    title: 'FDNY Violations',
    defaultId: 'avgm-ztsb',
    description: 'FDNY Fire Code violations.',
  },
  {
    key: 'asbestosViolations',
    title: 'DEP Asbestos Violations',
    defaultId: 'r6c3-8mpt',
    description: 'Asbestos abatement violations.',
  },
]

type NYCConfigState = {
  baseUrl: string
  appToken: string
  appTokenFull: string
  appTokenMasked: string | null
  hasAppToken: boolean
  isEnabled: boolean
  datasets: Record<DatasetKey, string>
}

export default function NYCDataSourcesPage() {
  const router = useRouter()
  const [config, setConfig] = useState<NYCConfigState>({
    baseUrl: 'https://data.cityofnewyork.us/',
    appToken: '',
    appTokenFull: '',
    appTokenMasked: null,
    hasAppToken: false,
    isEnabled: true,
    datasets: nycDatasets.reduce(
      (acc, d) => ({
        ...acc,
        [d.key]: d.defaultId,
      }),
      {} as Record<DatasetKey, string>
    ),
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const displayToken =
    config.appToken || config.appTokenFull || (config.hasAppToken ? config.appTokenMasked || '' : '')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/nyc-data/integration')
        if (!res.ok) throw new Error('Failed to load NYC Open Data integration')
        const data = await res.json()
        setConfig((prev) => ({
          ...prev,
          baseUrl: data.base_url || prev.baseUrl,
          appToken: '',
          appTokenFull: data.app_token_full || '',
          appTokenMasked: data.app_token_masked || null,
          hasAppToken: data.has_app_token || false,
          isEnabled: data.is_enabled ?? true,
          datasets: { ...prev.datasets, ...(data.datasets || {}) },
        }))
      } catch (error) {
        console.error(error)
        toast.error('Failed to load NYC Open Data integration')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveConfig = async () => {
    try {
      setSaving(true)
      const payload = {
        baseUrl: config.baseUrl,
        appToken: config.appToken || undefined,
        appTokenUnchanged: !config.appToken && config.hasAppToken,
        isEnabled: config.isEnabled,
        datasets: config.datasets,
      }
      const res = await fetch('/api/nyc-data/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save integration')
      toast.success('NYC Open Data integration saved')
      setConfig((prev) => ({
        ...prev,
        appToken: '',
        appTokenFull: prev.appToken || prev.appTokenFull,
        hasAppToken: Boolean(prev.appToken || prev.hasAppToken),
        appTokenMasked: prev.appToken ? '***' : prev.appTokenMasked,
      }))
    } catch (error) {
      console.error(error)
      toast.error('Failed to save NYC Open Data integration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/settings/integrations')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Integrations
        </Button>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">NYC Data Sources</h1>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          NYC Open Data is authoritative for devices/inspections/violations. DOB NOW remains the source for filings. You only need one Socrata App Token for all datasets below.
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Base URL</Label>
                <Input
                  value={config.baseUrl}
                  disabled={loading}
                  onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Socrata App Token</Label>
                <div className="flex gap-2">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={displayToken}
                    disabled={loading}
                    placeholder={config.hasAppToken ? `Saved (${config.appTokenMasked || '***'})` : 'e.g. abc123'}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        appToken: e.target.value,
                      }))
                    }
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setShowToken((prev) => !prev)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>Open Data = devices/inspections/violations. DOB NOW = filings/applications.</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {nycDatasets.map((dataset) => (
            <Card key={dataset.key}>
              <CardHeader>
                <CardTitle className="text-base">{dataset.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{dataset.description}</p>
                <div className="space-y-1">
                  <Label className="text-xs">Dataset ID</Label>
                  <Input
                    value={config.datasets[dataset.key]}
                    disabled={loading}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        datasets: { ...prev.datasets, [dataset.key]: e.target.value },
                      }))
                    }
                    className="text-xs"
                    placeholder={dataset.defaultId}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Default: {dataset.defaultId}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={saveConfig} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Integration'}
          </Button>
        </div>
      </div>
    </div>
  )
}
