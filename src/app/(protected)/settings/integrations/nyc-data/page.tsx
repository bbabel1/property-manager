"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ChevronDown, ChevronUp, Database, Eye, EyeOff, ShieldCheck } from 'lucide-react'

type DatasetKey =
  | 'elevatorDevices'
  | 'elevatorInspections'
  | 'dobSafetyViolations'
  | 'dobViolations'
  | 'dobActiveViolations'
  | 'dobEcbViolations'
  | 'dobComplaints'
  | 'bedbugReporting'
  | 'dobNowApprovedPermits'
  | 'dobNowSafetyBoiler'
  | 'dobNowSafetyFacade'
  | 'dobPermitIssuanceOld'
  | 'dobCertificateOfOccupancyOld'
  | 'dobCertificateOfOccupancyNow'
  | 'hpdViolations'
  | 'hpdComplaints'
  | 'hpdRegistrations'
  | 'fdnyViolations'
  | 'asbestosViolations'
  | 'sidewalkViolations'
  | 'heatSensorProgram'

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
    key: 'sidewalkViolations',
    title: 'Sidewalk Management Database - Violations',
    defaultId: '6kbp-uz6m',
    description:
      'Sidewalk Management System is used to track and organize inspections, violations and the status of New York City sidewalks. Identifies a Notice of Violation has been issued for a sidewalk defect.\nFor more information please visit NYC DOT website: www.nyc.gov/sidewalks',
  },
  {
    key: 'dobCertificateOfOccupancyNow',
    title: 'DOB NOW: Certificate of Occupancy',
    defaultId: 'pkdm-hqz6',
    description:
      'This data set includes certificates of occupancy issued through the New York City Department of Buildings\' DOB NOW: Certificate of Occupancy module. This module was released in March of 2021, anbd from that point onward this data set should be utilized instead of the \"DOB Certificate of Occupancy\" data set. The data is collected because the Department of Buildings tracks Certificates of Occupancies issued. This data include items such as job filing name, job filing label, BIN, Address, and Certificate of Occupancy status, sequence, label, and issuance date.\n\n\"A Certificate of Occupancy (CO) states a legal use and/or type of permitted occupancy of a building. New buildings must have a CO, and existing buildings must have a current or amended CO when there is a change in use, egress or type of occupancy. No one may legally occupy a building until the Department has issued a CO or Temporary Certificate of Occupancy (TCO).\n\nA CO confirms that the completed work complies with all applicable laws, all paperwork has been completed, all fees owed to the Department have been paid, all relevant violations have been resolved, and all necessary approvals have been received from other City Agencies. The Department issues a final CO when the completed work matches the submitted plans for new buildings or major alterations.\"',
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
  const [descriptionOpen, setDescriptionOpen] = useState<Record<DatasetKey, boolean>>(
    nycDatasets.reduce(
      (acc, d) => ({
        ...acc,
        [d.key]: false,
      }),
      {} as Record<DatasetKey, boolean>
    )
  )

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
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 gap-2 text-foreground"
                    onClick={() =>
                      setDescriptionOpen((prev) => ({ ...prev, [dataset.key]: !prev[dataset.key] }))
                    }
                  >
                    {descriptionOpen[dataset.key] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Description
                  </Button>
                  {descriptionOpen[dataset.key] && (
                    <p className="text-sm text-muted-foreground">{dataset.description}</p>
                  )}
                </div>
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
    </div>
  )
}
