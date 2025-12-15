/**
 * NYC Open Data Config Manager
 *
 * Stores developer-scoped NYC Open Data dataset IDs (global), base URL, and encrypted app token.
 * Provides env fallback and masking for safe UI responses.
 */

import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

export type NYCOpenDataDatasets = {
  elevatorDevices: string
  elevatorInspections: string
  elevatorViolationsActive: string
  elevatorViolationsHistoric: string
  elevatorComplaints: string
  dobSafetyViolations: string
  dobViolations: string
  dobActiveViolations: string
  dobEcbViolations: string
  dobComplaints: string
  bedbugReporting: string
  dobNowApprovedPermits: string
  dobNowJobFilings: string
  dobNowSafetyBoiler: string
  dobNowSafetyFacade: string
  dobPermitIssuanceOld: string
  dobJobApplications: string
  dobElevatorPermitApplications: string
  dobCertificateOfOccupancyOld: string
  dobCertificateOfOccupancyNow: string
  waterSewer: string
  waterSewerOld: string
  hpdViolations: string
  hpdComplaints: string
  hpdRegistrations: string
  buildingsSubjectToHPD: string
  indoorEnvironmentalComplaints: string
  fdnyViolations: string
  asbestosViolations: string
  sidewalkViolations: string
  backflowPreventionViolations: string
  heatSensorProgram: string
}

export type NYCOpenDataConfig = {
  baseUrl: string
  appToken: string | null
  hasAppToken: boolean
  geoserviceBaseUrl: string
  geoserviceApiKey: string | null
  hasGeoserviceApiKey: boolean
  datasets: NYCOpenDataDatasets
  isEnabled: boolean
  source: 'db' | 'env' | 'default'
}

export type NYCOpenDataConfigUpsert = Partial<NYCOpenDataDatasets> & {
  baseUrl?: string
  appToken?: string
  geoserviceBaseUrl?: string
  geoserviceApiKey?: string
  isEnabled?: boolean
  // Legacy compatibility
  elevatorViolations?: string
  elevatorViolationsActive?: string
  elevatorViolationsHistoric?: string
  elevatorComplaints?: string
  sidewalkViolations?: string
  backflowPreventionViolations?: string
  dobComplaints?: string
  dobCertificateOfOccupancyOld?: string
  dobCertificateOfOccupancyNow?: string
  heatSensorProgram?: string
  buildingsSubjectToHPD?: string
}

const DEFAULT_BASE_URL = process.env.NYC_OPEN_DATA_BASE_URL || 'https://data.cityofnewyork.us/'
const DEFAULT_GEOSERVICE_BASE_URL =
  process.env.NYC_GEOSERVICE_BASE_URL || 'https://api.nyc.gov/geoclient/v2/'

export const DEFAULT_DATASET_IDS: NYCOpenDataDatasets = {
  elevatorDevices: 'juyv-2jek', // DOB NOW Build – Elevator Devices
  elevatorInspections: 'e5aq-a4j2', // DOB NOW Elevator Safety Compliance Filings
  elevatorViolationsActive: 'rff7-h44d', // Active elevator violations
  elevatorViolationsHistoric: '9ucd-umy4', // Historic elevator violations by date
  elevatorComplaints: 'kqwi-7ncn', // Elevator complaints (311 → DOB)
  dobSafetyViolations: '855j-jady', // DOB Safety Violations (NYC Open Data - general)
  dobViolations: '3h2n-5cm9',
  dobActiveViolations: '6drr-tyq2',
  dobEcbViolations: '6bgk-3dad',
  dobComplaints: 'eabe-havv', // DOB Complaints Received
  bedbugReporting: 'wz6d-d3jb', // Bedbug Reporting (HPD)
  dobNowApprovedPermits: 'rbx6-tga4', // DOB NOW: Build – Approved Permits
  dobNowJobFilings: 'w9ak-ipjd', // DOB NOW: Build – Job Application Filings
  dobNowSafetyBoiler: '52dp-yji6', // DOB NOW: Safety Boiler
  dobNowSafetyFacade: 'xubg-57si', // DOB NOW: Safety – Facades Compliance Filings
  dobPermitIssuanceOld: 'ipu4-2q9a', // DOB Permit Issuance (OLD/BIS)
  dobJobApplications: 'ic3t-wcy2', // DOB Job Application Filings (BIS)
  dobElevatorPermitApplications: 'kfp4-dz4h', // DOB NOW: Build Elevator Permit Applications
  dobCertificateOfOccupancyOld: 'bs8b-p36w', // DOB Certificate Of Occupancy (Old)
  dobCertificateOfOccupancyNow: 'pkdm-hqz6', // DOB NOW: Certificate of Occupancy
  waterSewer: 'hphy-6g7m', // DEP Water and Sewer permits
  waterSewerOld: '4k4u-823g', // DEP Water and Sewer permits (OLD)
  hpdViolations: 'wvxf-dwi5',
  hpdComplaints: 'ygpa-z7cr',
  hpdRegistrations: 'tesw-yqqr', // HPD Registrations
  buildingsSubjectToHPD: 'kj4p-ruqc', // Buildings Subject to HPD Jurisdiction
  indoorEnvironmentalComplaints: '9jgj-bmct', // DOHMH Indoor Environmental Complaints
  fdnyViolations: 'avgm-ztsb',
  asbestosViolations: 'r6c3-8mpt',
  sidewalkViolations: '6kbp-uz6m', // Sidewalk Management Database - Violations
  backflowPreventionViolations: '38n4-tikp', // Backflow prevention device-related violations
  heatSensorProgram: 'h4mf-f24e', // Buildings Selected for the Heat Sensor Program (HSP)
}

async function loadDatasetsFromCatalog(): Promise<NYCOpenDataDatasets | null> {
  const { data, error } = await supabaseAdmin
    .from('data_sources')
    .select('key, dataset_id, is_enabled')
    .is('deleted_at', null)
    .order('key', { ascending: true })

  if (error) {
    logger.error({ error }, 'Failed to fetch data_sources catalog')
    return null
  }

  if (!data || data.length === 0) return null

  const result: NYCOpenDataDatasets = { ...DEFAULT_DATASET_IDS }
  for (const row of data) {
    if (row?.is_enabled === false) continue
    if (row?.key && typeof row.key === 'string' && row?.dataset_id) {
      const key = row.key as keyof NYCOpenDataDatasets
      if (key in result) {
        result[key] = row.dataset_id as string
      }
    }
  }
  return result
}

export function maskAppToken(token: string | null): string | null {
  if (!token) return null
  if (token.length <= 6) return '***'
  return `${token.substring(0, 3)}***${token.substring(token.length - 3)}`
}

/**
 * Resolve config (global, developer-managed) with env fallback.
 */
export async function getNYCOpenDataConfig(_orgId?: string): Promise<NYCOpenDataConfig> {
  const datasets = (await loadDatasetsFromCatalog()) || DEFAULT_DATASET_IDS

  const envBaseUrl = process.env.NYC_OPEN_DATA_BASE_URL
  const envGeoBaseUrl = process.env.NYC_GEOSERVICE_BASE_URL
  const envToken = process.env.NYC_OPEN_DATA_APP_TOKEN || process.env.NYC_OPEN_DATA_API_KEY || null
  const envGeoserviceKey = process.env.NYC_GEOSERVICE_API_KEY || process.env.NYC_GEOSERVICE_KEY || null

  return {
    baseUrl: envBaseUrl || DEFAULT_BASE_URL,
    appToken: envToken,
    hasAppToken: Boolean(envToken),
    geoserviceBaseUrl: envGeoBaseUrl || DEFAULT_GEOSERVICE_BASE_URL,
    geoserviceApiKey: envGeoserviceKey,
    hasGeoserviceApiKey: Boolean(envGeoserviceKey),
    datasets,
    isEnabled: true,
    source: envToken ? 'env' : 'db',
  }
}

/**
 * Upsert dataset catalog entries (global). Tokens and base URLs remain env-driven.
 */
export async function saveNYCOpenDataConfig(_orgId: string, payload: NYCOpenDataConfigUpsert): Promise<void> {
  const rows: Array<{ key: string; dataset_id: string; is_enabled?: boolean }> = []
  const datasetEntries: [keyof NYCOpenDataDatasets, string | undefined][] = [
    ['elevatorDevices', payload.elevatorDevices],
    ['elevatorInspections', payload.elevatorInspections],
    ['elevatorViolationsActive', payload.elevatorViolationsActive || payload.dobSafetyViolations],
    ['elevatorViolationsHistoric', payload.elevatorViolationsHistoric],
    ['elevatorComplaints', payload.elevatorComplaints],
    ['dobSafetyViolations', payload.dobSafetyViolations || payload.elevatorViolations],
    ['dobViolations', payload.dobViolations],
    ['dobActiveViolations', payload.dobActiveViolations],
    ['dobEcbViolations', payload.dobEcbViolations],
    ['dobComplaints', payload.dobComplaints],
    ['bedbugReporting', payload.bedbugReporting],
    ['dobNowApprovedPermits', payload.dobNowApprovedPermits],
    ['dobNowJobFilings', payload.dobNowJobFilings],
    ['dobNowSafetyBoiler', payload.dobNowSafetyBoiler],
    ['dobNowSafetyFacade', payload.dobNowSafetyFacade],
    ['dobPermitIssuanceOld', payload.dobPermitIssuanceOld],
    ['dobJobApplications', payload.dobJobApplications],
    ['dobElevatorPermitApplications', payload.dobElevatorPermitApplications],
    ['dobCertificateOfOccupancyOld', payload.dobCertificateOfOccupancyOld],
    ['dobCertificateOfOccupancyNow', payload.dobCertificateOfOccupancyNow],
    ['waterSewer', payload.waterSewer],
    ['waterSewerOld', payload.waterSewerOld],
    ['hpdViolations', payload.hpdViolations],
    ['hpdComplaints', payload.hpdComplaints],
    ['hpdRegistrations', payload.hpdRegistrations],
    ['buildingsSubjectToHPD', payload.buildingsSubjectToHPD],
    ['indoorEnvironmentalComplaints', payload.indoorEnvironmentalComplaints],
    ['fdnyViolations', payload.fdnyViolations],
    ['asbestosViolations', payload.asbestosViolations],
    ['sidewalkViolations', payload.sidewalkViolations],
    ['heatSensorProgram', payload.heatSensorProgram],
  ]

  for (const [key, value] of datasetEntries) {
    if (typeof value === 'string' && value.trim().length > 0) {
      rows.push({ key, dataset_id: value.trim(), is_enabled: payload.isEnabled ?? true })
    }
  }

  if (!rows.length) return

  const { error } = await supabaseAdmin.from('data_sources').upsert(rows)
  if (error) {
    logger.error({ error }, 'Failed to upsert data_sources')
    throw error
  }
}

export async function deleteNYCOpenDataConfig(orgId: string): Promise<void> {
  logger.warn({ orgId }, 'deleteNYCOpenDataConfig is a no-op in global data_sources mode')
}
