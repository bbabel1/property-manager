/* eslint-disable @typescript-eslint/ban-ts-comment */

"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Database, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

type DatasetKey =
  | 'elevatorDevices'
  | 'elevatorInspections'
  | 'elevatorViolationsActive'
  | 'elevatorViolationsHistoric'
  | 'elevatorComplaints'
  | 'dobSafetyViolations'
  | 'dobViolations'
  | 'dobActiveViolations'
  | 'dobEcbViolations'
  | 'dobComplaints'
  | 'bedbugReporting'
  | 'dobNowApprovedPermits'
  | 'dobNowJobFilings'
  | 'dobNowSafetyBoiler'
  | 'dobNowSafetyFacade'
  | 'dobPermitIssuanceOld'
  | 'dobJobApplications'
  | 'dobElevatorPermitApplications'
  | 'dobCertificateOfOccupancyOld'
  | 'dobCertificateOfOccupancyNow'
  | 'waterSewer'
  | 'waterSewerOld'
  | 'hpdViolations'
  | 'hpdComplaints'
  | 'hpdRegistrations'
  | 'buildingsSubjectToHPD'
  | 'indoorEnvironmentalComplaints'
  | 'fdnyViolations'
  | 'asbestosViolations'
  | 'backflowPreventionViolations'
  | 'sidewalkViolations'
  | 'heatSensorProgram'

type DatasetMeta = {
  key: DatasetKey
  title: string
  defaultId: string
  description: string
}

type DataSourceRow = {
  id: string
  key: string
  dataset_id: string
  title: string | null
  description: string | null
  is_enabled: boolean
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
    key: 'elevatorViolationsActive',
    title: 'Active Elevator Violations',
    defaultId: 'rff7-h44d',
    description: 'Active elevator-related violations requiring corrective action or missing filings.',
  },
  {
    key: 'elevatorViolationsHistoric',
    title: 'Elevator Violations by Date (Historic)',
    defaultId: '9ucd-umy4',
    description: 'Historic CAT1/CAT5 elevator violations with issuance/disposition details.',
  },
  {
    key: 'elevatorComplaints',
    title: 'Elevator Complaints (311 → DOB)',
    defaultId: 'kqwi-7ncn',
    description: 'Elevator complaints routed from 311 to DOB that often trigger inspections/enforcement.',
  },
  {
    key: 'dobSafetyViolations',
    title: 'DOB Safety Violations',
    defaultId: '855j-jady',
    description: 'Civil penalties issued/payable in DOB NOW (primary violation feed).',
  },
  {
    key: 'dobViolations',
    title: 'DOB Violations (Older)',
    defaultId: '3h2n-5cm9',
    description:
      'This data set includes older civil penalties (commonly referred to as ‘DOB Violations’) that were issued by the Department of Buildings (DOB) in the Buildings Information System (BIS). For newer civil penalties, see the DOB Safety Violations data set (note: some violations are duplicated in both data sets). Separately, summonses that are issued by DOB but adjudicated by OATH/ECB are in the DOB ECB Violations data set.',
  },
  {
    key: 'dobActiveViolations',
    title: 'Active DOB Violations',
    defaultId: '6drr-tyq2',
    description: 'Open DOB violations subset for BIN.',
  },
  {
    key: 'dobEcbViolations',
    title: 'DOB ECB Violations',
    defaultId: '6bgk-3dad',
    description:
      'This data set includes summonses issued by the Department of Buildings that are adjudicated by OATH/ECB. Separately, civil penalties (commonly referred to as ‘DOB Violations’) are found in the DOB Safety Violations (for newer issuances) and DOB Violations (for older issuances) data sets.',
  },
  {
    key: 'dobComplaints',
    title: 'DOB Complaints Received',
    defaultId: 'eabe-havv',
    description:
      'This is the universe of complaints received by Department of Buildings (DOB). It includes complaints that come from 311 or that are entered into the system by DOB staff.\n\nA Complaint Categories codes can be found at\nhttp://www1.nyc.gov/assets/buildings/pdf/bis_complaint_disposition_codes.pdf',
  },
  {
    key: 'dobNowApprovedPermits',
    title: 'DOB NOW: Build – Approved Permits',
    defaultId: 'rbx6-tga4',
    description:
      'List of all approved construction permits in DOB NOW except for Electrical, Elevator, and Limited Alteration Application (LAA) which have their own datasets.',
  },
  {
    key: 'dobNowJobFilings',
    title: 'DOB NOW: Build – Job Application Filings',
    defaultId: 'w9ak-ipjd',
    description:
      'Job Application Filings contains detailed records of construction, renovation, and equipment-related job applications submitted through DOB NOW, including work type (e.g., boiler, elevator, plumbing), building identifiers (BIN/BBL), applicant and contractor information, scope of work, permit status, and approval or sign-off milestones.',
  },
  {
    key: 'dobNowSafetyBoiler',
    title: 'DOB NOW: Safety Boiler',
    defaultId: '52dp-yji6',
    description:
      'Annual compliance filings for high and low pressure boilers installed in buildings. Represents device filings (not the boiler device master).',
  },
  {
    key: 'dobNowSafetyFacade',
    title: 'DOB NOW: Safety – Facades Compliance Filings',
    defaultId: 'xubg-57si',
    description: 'List of all Facades compliance filings submitted in DOB NOW.',
  },
  {
    key: 'dobPermitIssuanceOld',
    title: 'DOB Permit Issuance (OLD)',
    defaultId: 'ipu4-2q9a',
    description:
      'BIS-era permit issuance records (one permit per work type) covering New Building, Demolition, and Alterations 1/2/3 work types. Updated daily; superseded by DOB NOW: Build – Approved Permits for new permits.',
  },
  {
    key: 'dobJobApplications',
    title: 'DOB Job Application Filings',
    defaultId: 'ic3t-wcy2',
    description:
      'This dataset contains all job applications submitted through the Borough Offices, through eFiling, or through the HUB, which have a "Latest Action Date" since January 1, 2000. This dataset does not include jobs submitted through DOB NOW. See the >DOB NOW: Build – Job Application Filings dataset for DOB NOW jobs.',
  },
  {
    key: 'dobElevatorPermitApplications',
    title: 'DOB NOW: Build Elevator Permit Applications',
    defaultId: 'kfp4-dz4h',
    description:
      'Elevator permit/job filings (ELV1) submitted in DOB NOW: Build, including Initial, Subsequent, and Post Approval Amendment filings. Contains filing status, work type, applicant/owner info, and location fields (BIN/block/lot/BBL).',
  },
  {
    key: 'waterSewer',
    title: 'DEP Water and Sewer Permits',
    defaultId: 'hphy-6g7m',
    description:
      'The DEP Application and Permit data will contain information about the different types of applications approved and permits issued on a regular basis.',
  },
  {
    key: 'waterSewerOld',
    title: 'DEP Water and Sewer (OLD)',
    defaultId: '4k4u-823g',
    description:
      'The DEP Application and Permit data will contain information about the different types of applications approved and permits issued on a regular basis. For the latest information, please refer to the Water and Sewer Permits dataset.',
  },
  {
    key: 'indoorEnvironmentalComplaints',
    title: 'DOHMH Indoor Environmental Complaints',
    defaultId: '9jgj-bmct',
    description:
      '311-sourced indoor environmental complaints captured by DOHMH. Use to see whether an indoor environmental complaint was filed for a property/address.',
  },
  {
    key: 'dobCertificateOfOccupancyOld',
    title: 'DOB Certificate Of Occupancy (Old)',
    defaultId: 'bs8b-p36w',
    description:
      'A Certificate of Occupancy (CO) states a building’s legal use and/or type of permitted occupancy. New buildings must have a CO, and existing buildings must have a current or amended CO when there is a change in use, egress or type of occupancy. No one may legally occupy a building until the Department has issued a Certificate of Occupancy or Temporary Certificate of Occupancy. The Department issues a final Certificate of Occupancy when the completed work matches the submitted plans for new buildings or major alterations. It issues a Letter of Completion for minor alterations to properties. These documents confirm the work complies with all applicable laws, all paperwork has been completed, all fees owed to the Department have been paid, all relevant violations have been resolved and all necessary approvals have been received from other City Agencies.\n\nThis dataset contains all Certificates of Occupancy issued from 7/12/2012 to March 2021. PDFs of the actual COs are viewable in www.nyc.gov/bis.\n\nFor COs issued since March 2021, see DOB NOW: Certificate of Occupancy dataset.',
  },
  {
    key: 'dobCertificateOfOccupancyNow',
    title: 'DOB NOW: Certificate of Occupancy',
    defaultId: 'pkdm-hqz6',
    description:
      'This data set includes certificates of occupancy issued through the New York City Department of Buildings\' DOB NOW: Certificate of Occupancy module. This module was released in March of 2021, anbd from that point onward this data set should be utilized instead of the \"DOB Certificate of Occupancy\" data set. The data is collected because the Department of Buildings tracks Certificates of Occupancies issued. This data include items such as job filing name, job filing label, BIN, Address, and Certificate of Occupancy status, sequence, label, and issuance date.\n\n\"A Certificate of Occupancy (CO) states a legal use and/or type of permitted occupancy of a building. New buildings must have a CO, and existing buildings must have a current or amended CO when there is a change in use, egress or type of occupancy. No one may legally occupy a building until the Department has issued a CO or Temporary Certificate of Occupancy (TCO).\n\nA CO confirms that the completed work complies with all applicable laws, all paperwork has been completed, all fees owed to the Department have been paid, all relevant violations have been resolved, and all necessary approvals have been received from other City Agencies. The Department issues a final CO when the completed work matches the submitted plans for new buildings or major alterations.\"',
  },
  {
    key: 'hpdViolations',
    title: 'Housing Maintenance Code Violations',
    defaultId: 'wvxf-dwi5',
    description:
      "ursuant to New York City’s Housing Maintenance Code, the Department of Housing Preservation and Development (HPD) issues violations against conditions, in rental dwelling units and buildings, that have been verified to violate the New York City Housing Maintenance Code (HMC) or the New York State Multiple Dwelling Law (MDL).\nEach row in this dataset contains discrete information about one violation of the New York City Housing Maintenance Code or New York State Multiple Dwelling Law. Each violation is identified using a unique Violation ID. These Laws are in place to provide requirements for the maintenance of residential dwelling units within New York City.\nViolations are issued by Housing Inspectors after a physical inspection is conducted (except for class I violations which are generally administratively issued). Violations are issued in four classes: Class A (non-hazardous), Class B (hazardous), Class C (immediately hazardous) and Class I (information orders). For more information on violations, see https://www1.nyc.gov/site/hpd/owners/compliance-clear-violations.page\nThe base data for this file is all violations open as of October 1, 2012. Violation data is updated daily. The daily update includes both new violations and updates to the status of previously issued violations. An open violation is a violation which is still active on the Department records. See the status table for determining how to filter for open violations versus closed violations, and within open violations for a more detailed current status.\nThe property owner may or may not have corrected the physical condition if the status is open. The violation status is closed when the violation is observed/verified as corrected by HPD or as certified by the landlord. The processes for having violations dismissed are described at http://www1.nyc.gov/site/hpd/owners/compliance-clear-violations.page\nUsing other HPD datasets, such as the Building File or the Registration File, a user can link together violations issued for given buildings or for given owners.",
  },
  {
    key: 'hpdComplaints',
    title: 'HPD Complaints / Problems',
    defaultId: 'ygpa-z7cr',
    description: 'HPD complaints/problems (precursors to violations).',
  },
  {
    key: 'hpdRegistrations',
    title: 'HPD Registrations',
    defaultId: 'tesw-yqqr',
    description:
      "HPD registrations collected under the NYC Housing Maintenance Code. Owners must register residential buildings with three or more units, or one- and two-family homes where the owner or immediate family do not live in the building. Registrations are required when taking ownership and renewed annually.",
  },
  {
    key: 'buildingsSubjectToHPD',
    title: 'Buildings Subject to HPD Jurisdiction',
    defaultId: 'kj4p-ruqc',
    description:
      'Buildings under HPD jurisdiction, keyed by BIN/BuildingID. Includes ownership/contact metadata, counts, and registration status for multiple dwellings required to register with HPD.',
  },
  {
    key: 'bedbugReporting',
    title: 'Bedbug Reporting',
    defaultId: 'wz6d-d3jb',
    description:
      'Property owners are required to obtain bedbug infestation history from tenants or the dwelling unit owner and self-report it annually. Each record represents a filing for a period (newer record replaces prior for the same period). BIN/BBL address data plus counts of units with infestations, eradicated units, re-infested units, filing period start/end, filing date, registration/building IDs, community/council districts, NTA, census tract, and coordinates are included. Queryable by BIN for building-level lookups.',
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
  {
    key: 'backflowPreventionViolations',
    title: 'Backflow Prevention Violations',
    defaultId: '38n4-tikp',
    description: 'OATH violations filtered for backflow prevention devices.',
  },
  {
    key: 'sidewalkViolations',
    title: 'Sidewalk Management Database - Violations',
    defaultId: '6kbp-uz6m',
    description:
      'Sidewalk Management System is used to track and organize inspections, violations and the status of New York City sidewalks. Identifies a Notice of Violation has been issued for a sidewalk defect.\nFor more information please visit NYC DOT website: www.nyc.gov/sidewalks',
  },
  {
    key: 'heatSensorProgram',
    title: 'Buildings Selected for the Heat Sensor Program (HSP)',
    defaultId: 'h4mf-f24e',
    description:
      'Every two years beginning in July 2020, the Department of Housing Preservation and Development (HPD) designates 50 class \"A\" multiple dwellings with heat violations and complaints for participation in a program requiring installation of heat sensors.',
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
  const [dataSources, setDataSources] = useState<DataSourceRow[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [addSourceOpen, setAddSourceOpen] = useState(false)
  const [addingSource, setAddingSource] = useState(false)
  const [newSource, setNewSource] = useState({
    key: '',
    datasetId: '',
    title: '',
    description: '',
    isEnabled: true,
  })
  const [editSource, setEditSource] = useState<DataSourceRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingSource, setEditingSource] = useState(false)
  const [editValues, setEditValues] = useState({
    datasetId: '',
    title: '',
    description: '',
    isEnabled: true,
  })

  const displayToken =
    config.appToken || config.appTokenFull || (config.hasAppToken ? config.appTokenMasked || '' : '')

  const syncDatasetsFromSources = (sources: DataSourceRow[]) => {
    setConfig((prev) => {
      const updates: Partial<Record<DatasetKey, string>> = {}
      sources.forEach((source) => {
        if (source.is_enabled !== false && Object.prototype.hasOwnProperty.call(prev.datasets, source.key)) {
          updates[source.key as DatasetKey] = source.dataset_id
        }
      })
      if (!Object.keys(updates).length) return prev
      return { ...prev, datasets: { ...prev.datasets, ...updates } }
    })
  }

  const upsertSourceInState = (source: DataSourceRow) => {
    setDataSources((prev) => {
      const filtered = prev.filter((item) => item.id !== source.id)
      const updated = [...filtered, source].sort((a, b) => a.title?.localeCompare(b.title || '') || 0)
      syncDatasetsFromSources(updated)
      return updated
    })
  }

  const loadDataSources = async () => {
    try {
      setSourcesLoading(true)
      const res = await fetch('/api/nyc-data/sources')
      if (!res.ok) throw new Error('Failed to load data sources')
      const data = await res.json()
      const rows = ((data?.data as DataSourceRow[]) || []).sort((a, b) =>
        (a.title || a.key).localeCompare(b.title || b.key)
      )
      setDataSources(rows)
      syncDatasetsFromSources(rows)
    } catch (error) {
      console.error(error)
      toast.error('Failed to load data sources')
    } finally {
      setSourcesLoading(false)
    }
  }

  useEffect(() => {
    loadDataSources()
  }, [])

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

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const handleAddSource = async () => {
    const datasetId = newSource.datasetId.trim()
    const title = newSource.title.trim()
    const description = newSource.description.trim()
    const slug = newSource.key.trim() || generateSlug(title || datasetId) || undefined

    if (!datasetId) {
      toast.error('Dataset ID is required')
      return
    }

    try {
      setAddingSource(true)
      const res = await fetch('/api/nyc-data/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: slug,
          datasetId,
          title: title || undefined,
          description: description || undefined,
          isEnabled: newSource.isEnabled,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to add data source')
      }

      const created = (data?.data as DataSourceRow) || null
      if (created) {
        upsertSourceInState(created)
      } else {
        await loadDataSources()
      }

      toast.success('Data source added')
      setNewSource({ key: '', datasetId: '', title: '', description: '', isEnabled: true })
      setAddSourceOpen(false)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to add data source')
    } finally {
      setAddingSource(false)
    }
  }

  const handleManageClick = (source: DataSourceRow) => {
    setEditSource(source)
    setEditValues({
      datasetId: source.dataset_id,
      title: source.title || '',
      description: source.description || '',
      isEnabled: source.is_enabled,
    })
    setEditOpen(true)
  }

  const handleUpdateSource = async () => {
    if (!editSource) return

    const datasetId = editValues.datasetId.trim()
    const title = editValues.title.trim()
    const description = editValues.description.trim()

    if (!datasetId) {
      toast.error('Dataset ID is required')
      return
    }

    try {
      setEditingSource(true)
      const res = await fetch('/api/nyc-data/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editSource.id,
          key: editSource.key,
          datasetId,
          title: title || undefined,
          description: description || undefined,
          isEnabled: editValues.isEnabled,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to update data source')
      }

      const updated = (data?.data as DataSourceRow) || null
      if (updated) {
        upsertSourceInState(updated)
      } else {
        await loadDataSources()
      }

      toast.success('Data source updated')
      setEditOpen(false)
      setEditSource(null)
      setEditValues({ datasetId: '', title: '', description: '', isEnabled: true })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Failed to update data source')
    } finally {
      setEditingSource(false)
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

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Data Source Catalog</CardTitle>
              <p className="text-xs text-muted-foreground">
                Manage entries stored in the NYC data sources table.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddSourceOpen(true)}>
              Add Source
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {sourcesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading data sources...
              </div>
            ) : dataSources.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Key</TableHead>
                    <TableHead className="w-[160px]">Dataset ID</TableHead>
                    <TableHead className="w-[200px]">Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px] text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataSources.map((source) => (
                    <TableRow key={source.key}>
                      <TableCell className="font-mono text-xs text-foreground">{source.key}</TableCell>
                      <TableCell className="font-mono text-xs text-foreground">{source.dataset_id}</TableCell>
                      <TableCell className="text-sm text-foreground">{source.title || '—'}</TableCell>
                      <TableCell className="w-[420px] max-w-[420px] text-xs text-muted-foreground align-top">
                        <div
                          className="overflow-hidden text-ellipsis"
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                        >
                          {source.description || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            source.is_enabled
                              ? 'status-pill border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                              : 'status-pill'
                          }
                        >
                          {source.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleManageClick(source)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No data sources yet. Click &quot;Add Source&quot; to add one to the table.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground">HPD Charge Data (not configured)</div>
          <p className="text-xs text-muted-foreground">
            These datasets are not yet wired into the sync pipeline; table columns still need to be mapped before use.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              {
                title: 'Open Market Order (OMO) Charges',
                defaultId: 'mdbu-nrqn',
                description:
                  "The data set contains information on work orders created through HPD's Emergency Repair Program, Alternative Enforcement Program and Demolition programs and fees assessed against properties by HPD pursuant to the Housing Maintenance Code. The work orders are created to conduct emergency repair work when an owner fails to address a hazardous condition pursuant to the requirements of an HPD-issued violation, a Department of Buildings Declaration of Emergency, a Department of Health Commissioner's Order to Abate or an emergency violation issued by another City Agency. The work orders may be issued to a private vendor following the City's Procurement Rules or may be conducted by agency staff.",
              },
              {
                title: 'Handyman Work Order (HWO) Charges',
                defaultId: 'sbnd-xujn',
                description:
                  'Contains information about work orders created to conduct emergency repair work when an owner fails to address a hazardous condition pursuant to the requirements of an HPD issued violation. HPD issues violations when an owner fails to address a condition pursuant New York City Housing Maintenance Code (HMC) or the New York State Multiple Dwelling Law (MDL), a Department of Buildings Declaration of Emergency, a Department of Health Commissioner\'s Order to Abate or an emergency violation issued by another City Agency. The work orders were carried out by agency staff.',
              },
              {
                title: 'Invoices for Open Market Order (OMO) Charges',
                defaultId: 'emrz-5p35',
                description: 'Contains information about invoices submitted to HPD by private contractors under an OMO.',
              },
            ].map((card) => (
              <Card key={card.title}>
                <CardHeader>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{card.description}</p>
                  <p className="text-xs text-muted-foreground">Dataset ID: {card.defaultId}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={saveConfig} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Integration'}
          </Button>
        </div>
      </div>

      <Dialog
        open={addSourceOpen}
        onOpenChange={(open) => {
          setAddSourceOpen(open)
          if (!open) {
            setNewSource({ key: '', datasetId: '', title: '', description: '', isEnabled: true })
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
            <DialogDescription>
              Add a new entry to the NYC data sources table. Keys are generated automatically; use a clear title.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Dataset ID</Label>
              <Input
                value={newSource.datasetId}
                onChange={(e) => setNewSource((prev) => ({ ...prev, datasetId: e.target.value }))}
                placeholder="abcd-1234"
                disabled={addingSource}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={newSource.title}
                onChange={(e) => setNewSource((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="DOB NOW: Safety – Facades Compliance Filings"
                disabled={addingSource}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newSource.description}
                onChange={(e) => setNewSource((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Optional context for this data source"
                disabled={addingSource}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Disabled sources stay in the table but are ignored by sync jobs.
                </p>
              </div>
              <Switch
                checked={newSource.isEnabled}
                onCheckedChange={(checked) =>
                  setNewSource((prev) => ({ ...prev, isEnabled: Boolean(checked) }))
                }
                disabled={addingSource}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setAddSourceOpen(false)} disabled={addingSource}>
              Cancel
            </Button>
            <Button onClick={handleAddSource} disabled={addingSource}>
              {addingSource && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditSource(null)
            setEditValues({ datasetId: '', title: '', description: '', isEnabled: true })
            setEditingSource(false)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Data Source</DialogTitle>
            <DialogDescription>
              Update dataset details used by the NYC data sync pipeline.
            </DialogDescription>
          </DialogHeader>
          {editSource ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input value={editSource.key} disabled />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dataset ID</Label>
                <Input
                  value={editValues.datasetId}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, datasetId: e.target.value }))}
                  disabled={editingSource}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={editValues.title}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={editingSource}
                  placeholder="Optional friendly name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={editValues.description}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional context for this data source"
                  disabled={editingSource}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="space-y-1">
                  <Label className="text-xs">Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Disabled sources stay in the table but are ignored by sync jobs.
                  </p>
                </div>
                <Switch
                  checked={editValues.isEnabled}
                  onCheckedChange={(checked) =>
                    setEditValues((prev) => ({ ...prev, isEnabled: Boolean(checked) }))
                  }
                  disabled={editingSource}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a data source to manage it.</p>
          )}
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editingSource}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSource} disabled={editingSource || !editSource}>
              {editingSource && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
