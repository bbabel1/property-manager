/**
 * NYC API Client
 *
 * Clients for:
 * - DOB NOW (filings / in-progress applications)
 * - NYC Open Data (authoritative for devices, inspections, violations)
 * - HPD / FDNY passthrough (kept for compatibility)
 */

import { logger } from './logger'
import { env } from './env'

export interface NYCAPIConfig {
  dobNowBaseUrl?: string
  nycOpenDataBaseUrl?: string
  nycOpenDataApiKey?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  datasets?: Partial<NYCOpenDataDatasets>
}

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
  dobPermitIssuanceOld: string
  dobJobApplications: string
  dobElevatorPermitApplications: string
  dobCertificateOfOccupancyOld: string
  dobCertificateOfOccupancyNow: string
  waterSewer: string
  waterSewerOld: string
  buildingsSubjectToHPD: string
  indoorEnvironmentalComplaints: string
  dobNowSafetyBoiler: string
  dobNowSafetyFacade: string
  hpdViolations: string
  hpdComplaints: string
  hpdRegistrations: string
  fdnyViolations: string
  asbestosViolations: string
  sidewalkViolations: string
  backflowPreventionViolations: string
  heatSensorProgram: string
}

const DOB_NOW_SAFETY_BOILER_COLUMNS = [
  'tracking_number',
  'boiler_id',
  'report_type',
  'applicantfirst_name',
  'applicant_last_name',
  'applicant_license_type',
  'applicant_license_number',
  'owner_first_name',
  'owner_last_name',
  'boiler_make',
  'boiler_model',
  'pressure_type',
  'inspection_type',
  'inspection_date',
  'defects_exist',
  'lff_45_days',
  'lff_180_days',
  'filing_fee',
  'total_amount_paid',
  'report_status',
  'bin_number',
] as const

const DOB_NOW_SAFETY_FACADE_COLUMNS = [
  'tr6_no',
  'control_no',
  'filing_type',
  'cycle',
  'bin',
  'house_no',
  'street_name',
  'borough',
  'block',
  'lot',
  'sequence_no',
  'submitted_on',
  'current_status',
  'qewi_name',
  'qewi_bus_name',
  'qewi_bus_street_name',
  'qewi_city',
  'qewi_state',
  'qewi_zip',
  'qewi_nys_lic_no',
  'owner_name',
  'owner_bus_name',
  'owner_bus_street_name',
  'owner_city',
  'owner_zip',
  'owner_state',
  'filing_date',
  'filing_status',
  'prior_cycle_filing_date',
  'prior_status',
  'field_inspection_completed_date',
  'qewi_signed_date',
  'late_filing_amt',
  'failure_to_file_amt',
  'failure_to_collect_amt',
  'comments',
  'exterior_wall_type_s_',
  'exterior_wall_type_other_description',
  'exterior_wall_material_s_',
  'exterior_wall_material_other_description',
] as const

const DEFAULT_OPEN_DATA_DATASETS: NYCOpenDataDatasets = {
  elevatorDevices: 'juyv-2jek', // DOB NOW Build – Elevator Devices
  elevatorInspections: 'e5aq-a4j2', // DOB NOW Elevator Safety Compliance Filings
  elevatorViolationsActive: 'rff7-h44d', // Active elevator violations
  elevatorViolationsHistoric: '9ucd-umy4', // Historic elevator violations
  elevatorComplaints: 'kqwi-7ncn', // Elevator complaints (311 → DOB)
  dobSafetyViolations: '855j-jady', // DOB Safety Violations
  dobViolations: '3h2n-5cm9',
  dobActiveViolations: '6drr-tyq2',
  dobEcbViolations: '6bgk-3dad',
  dobComplaints: 'eabe-havv',
  bedbugReporting: 'wz6d-d3jb',
  dobNowApprovedPermits: 'rbx6-tga4',
  dobNowJobFilings: 'w9ak-ipjd',
  dobPermitIssuanceOld: 'ipu4-2q9a',
  dobJobApplications: 'ic3t-wcy2',
  dobElevatorPermitApplications: 'kfp4-dz4h',
  dobCertificateOfOccupancyOld: 'bs8b-p36w',
  dobCertificateOfOccupancyNow: 'pkdm-hqz6',
  waterSewer: 'hphy-6g7m',
  waterSewerOld: '4k4u-823g',
  buildingsSubjectToHPD: 'kj4p-ruqc',
  indoorEnvironmentalComplaints: '9jgj-bmct',
  dobNowSafetyBoiler: '52dp-yji6',
  dobNowSafetyFacade: 'xubg-57si',
  hpdViolations: 'wvxf-dwi5',
  hpdComplaints: 'ygpa-z7cr',
  hpdRegistrations: 'tesw-yqqr',
  fdnyViolations: 'avgm-ztsb',
  asbestosViolations: 'r6c3-8mpt',
  sidewalkViolations: '6kbp-uz6m',
  backflowPreventionViolations: '38n4-tikp',
  heatSensorProgram: 'h4mf-f24e',
}

type NYCOpenDataRecord = Record<string, unknown>
type HPDRegistrationRecord = NYCOpenDataRecord & {
  bin?: string
  registrationid?: string
  boro?: string
  block?: string
  lot?: string
  lastregistrationdate?: string
}
type SafetyFacadeFilingRecord = NYCOpenDataRecord &
  Partial<Record<(typeof DOB_NOW_SAFETY_FACADE_COLUMNS)[number], string | null>>
type SafetyBoilerFilingRecord = NYCOpenDataRecord &
  Partial<Record<(typeof DOB_NOW_SAFETY_BOILER_COLUMNS)[number], string | null>>
type DOBComplaintRecord = NYCOpenDataRecord & {
  bin?: string
  boro?: string
  borough?: string
  complaint_number?: string
  date_entered?: string
  status?: string
  house__?: string
  house_number?: string
  street?: string
}
type DOBPermitIssuanceRecord = NYCOpenDataRecord & {
  bin__?: string
  borough?: string
  block?: string
  lot?: string
  job__?: string
  permit_si_no?: string
}
type DOBJobApplicationRecord = NYCOpenDataRecord & {
  bin__?: string
  borough?: string
  block?: string
  lot?: string
  job__?: string
}
type DOBNowJobFilingRecord = NYCOpenDataRecord & {
  bin?: string
  bbl?: string
  job_filing_number?: string
}
type DOBSafetyViolationRecord = NYCOpenDataRecord & {
  bin?: string
  bbl?: string
  violation_number?: string
  violation_issue_date?: string
  issue_date?: string
  violation_remarks?: string
  violation_type?: string
  violation_status?: string
  status?: string
  cycle_end_date?: string
  device_number?: string
}
type DOBViolationRecord = NYCOpenDataRecord & {
  bin?: string
  isn_dob_bis_viol?: string | number
  violation_number?: string
  violationid?: string
  violation_date?: string
  issue_date?: string
  violation_description?: string
  description?: string
  device_number?: string
  disposition_date?: string
  status?: string
}
type DOBActiveViolationRecord = NYCOpenDataRecord & {
  bin?: string
  isn_dob_bis_viol?: string | number
  violation_number?: string
  violation_date?: string
  issue_date?: string
  violation_description?: string
  description?: string
  device_number?: string
}
type DOBECBViolationRecord = NYCOpenDataRecord & {
  bin?: string
  ecb_violation_number?: string
  summons_number?: string
  violation_date?: string
  issue_date?: string
  violation_description?: string
  description?: string
  hearing_status?: string
  status?: string
  cure_date?: string
  device_number?: string
}
type SidewalkViolationRecord = NYCOpenDataRecord & {
  bblid?: string
  inspection_date?: string
  violation_date?: string
  status?: string
}
type BedbugReportRecord = NYCOpenDataRecord & {
  bin?: string
  bbl?: string
  filing_date?: string
  building_registration_id?: string
  annual_bedbug_submitted?: string
  infestation_history?: string
}
type WaterSewerRecord = NYCOpenDataRecord & {
  propertyblock?: string
  propertylot?: string
  permit_type?: string
  permit_status?: string
}
type WaterSewerOldRecord = NYCOpenDataRecord & {
  block?: string
  lot?: string
  permit_type?: string
  permit_status?: string
}
type DOBCertificateOfOccupancyRecord = NYCOpenDataRecord & {
  bin?: string
  job__?: string
  co_number?: string
  issue_date?: string
}
type DOBElevatorPermitApplicationRecord = NYCOpenDataRecord & {
  bin?: string
  block?: string
  lot?: string
  job_filing_number?: string
}
type HeatSensorProgramRecord = NYCOpenDataRecord & {
  bin?: string
  bbl?: string
  buildingid?: string
  cycle?: string
}

export interface ElevatorDevice {
  deviceId: string
  bin: string
  deviceNumber: string
  deviceType: string
  status: string
  lastInspectionDate?: string | null
  nextInspectionDue?: string | null
  [key: string]: unknown
}

export interface ElevatorFiling {
  filingNumber: string
  deviceId: string
  filingType: string
  filingDate: string
  status: string
  result?: string
  defects?: boolean
  inspectorName?: string
  inspectorCompany?: string
  [key: string]: unknown
}

export interface Violation {
  violationNumber: string
  bin: string | null
  agency: string
  issueDate: string | null
  description: string
  status: string
  cureByDate?: string | null
  severityScore?: number
  deviceNumber?: string | null
  category?: 'violation' | 'complaint'
  [key: string]: unknown
}

const asString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return fallback
  return String(value)
}

const asNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : String(value)
}

const asOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  return typeof value === 'string' ? value : String(value)
}

export class DOBNowClient {
  private baseUrl: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(config?: NYCAPIConfig) {
    this.baseUrl = config?.dobNowBaseUrl || env.DOB_NOW_API_BASE_URL || 'https://a810-bisweb.nyc.gov/bisweb/'
    this.timeout = config?.timeout || 30000
    this.retryAttempts = config?.retryAttempts || 3
    this.retryDelay = config?.retryDelay || 1000
  }

  async fetchElevatorDevices(bin: string): Promise<ElevatorDevice[]> {
    try {
      const url = `${this.baseUrl}ElevatorDeviceService?bin=${bin}`
      const response = await this.makeRequest<ElevatorDevice[]>(url)
      return Array.isArray(response) ? response : []
    } catch (error) {
      logger.error({ error, bin }, 'Failed to fetch elevator devices from DOB NOW')
      throw error
    }
  }

  async fetchElevatorFilings(deviceId: string): Promise<ElevatorFiling[]> {
    try {
      const url = `${this.baseUrl}ElevatorFilingService?deviceId=${deviceId}`
      const response = await this.makeRequest<ElevatorFiling[]>(url)
      return Array.isArray(response) ? response : []
    } catch (error) {
      logger.error({ error, deviceId }, 'Failed to fetch elevator filings from DOB NOW')
      throw error
    }
  }

  async fetchBoilerFilings(bin: string): Promise<ElevatorFiling[]> {
    try {
      const url = `${this.baseUrl}BoilerFilingService?bin=${bin}`
      const response = await this.makeRequest<ElevatorFiling[]>(url)
      return Array.isArray(response) ? response : []
    } catch (error) {
      logger.error({ error, bin }, 'Failed to fetch boiler filings from DOB NOW')
      throw error
    }
  }

  async fetchViolations(bin: string, agency?: string): Promise<Violation[]> {
    try {
      let url = `${this.baseUrl}ViolationService?bin=${bin}`
      if (agency) url += `&agency=${agency}`
      const response = await this.makeRequest<Violation[]>(url)
      return Array.isArray(response) ? response : []
    } catch (error) {
      logger.error({ error, bin, agency }, 'Failed to fetch violations from DOB NOW')
      throw error
    }
  }

  private async makeRequest<T>(url: string): Promise<T> {
    const config: RequestInit = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`DOB NOW API error: ${response.status} ${errorText}`)
        }
        return (await response.json()) as T
      } catch (error) {
        lastError = error as Error
        if (attempt < this.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)))
          continue
        }
        throw error
      }
    }
    throw lastError || new Error('Unknown error in DOB NOW API request')
  }
}

export class NYCOpenDataClient {
  private baseUrl: string
  private baseUrlNormalized: string
  private apiKey?: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number
  private datasets: NYCOpenDataDatasets
  private datasetColumnsCache: Map<string, string[]>

  constructor(config?: NYCAPIConfig & { appToken?: string }) {
    this.baseUrl = config?.nycOpenDataBaseUrl || env.NYC_OPEN_DATA_BASE_URL || 'https://data.cityofnewyork.us/'
    this.baseUrlNormalized = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`
    this.apiKey = config?.appToken || config?.nycOpenDataApiKey || env.NYC_OPEN_DATA_APP_TOKEN || env.NYC_OPEN_DATA_API_KEY
    this.timeout = config?.timeout || 30000
    this.retryAttempts = config?.retryAttempts || 3
    this.retryDelay = config?.retryDelay || 1000
    this.datasets = {
      ...DEFAULT_OPEN_DATA_DATASETS,
      ...(config?.datasets || {}),
    }
    this.datasetColumnsCache = new Map()
  }

  // Elevator devices (Open Data authoritative)
  async fetchElevatorDevicesByBin(bin: string, limit = 5000, offset = 0): Promise<ElevatorDevice[]> {
    // The Elevator Safety Compliance dataset (e5aq-a4j2) supports BIN filtering.
    const records = await this.fetchDatasetRecords(this.datasets.elevatorInspections, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })

    const devices = new Map<string, ElevatorDevice>()
    for (const rec of records || []) {
      const deviceNumber =
        rec.device_number ||
        rec.deviceid ||
        rec.device_id ||
        rec.device_num ||
        rec.device_no ||
        null
      if (!deviceNumber) continue

      const normalizedDevice = String(deviceNumber)
      if (devices.has(normalizedDevice)) continue

      devices.set(normalizedDevice, {
        deviceId: normalizedDevice,
        deviceNumber: normalizedDevice,
        bin: rec.bin ? String(rec.bin) : bin,
        deviceType: asString(rec.device_type || rec.type || rec.device_category, 'Unknown'),
        status: asString(rec.device_status || rec.status || rec.operational_status, 'unknown'),
        lastInspectionDate: asNullableString(
          rec.periodic_latest_inspection ||
            rec.cat1_latest_report_filed ||
            rec.cat5_latest_report_filed ||
            rec.status_date,
        ),
        nextInspectionDue: asNullableString(rec.next_inspection_due || rec.next_inspection_date),
        ...rec,
      })
    }

    return Array.from(devices.values())
  }

  // Elevator inspections/tests (Open Data authoritative)
  async fetchElevatorInspections(
    deviceNumber: string,
    bin?: string,
    limit = 5000,
    offset = 0
  ): Promise<ElevatorFiling[]> {
    const filters: Record<string, string> = {
      device_number: deviceNumber,
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) filters.bin = bin
    const records = await this.fetchDatasetRecords(this.datasets.elevatorInspections, filters)
    return (records || []).map((rec) => {
      const filingNumber =
        rec.filing_number ||
        rec.tracking_number ||
        rec.control_number ||
        rec.inspection_id ||
        rec.test_id ||
        rec.id ||
        rec.device_number
      const filingDateValue =
        rec.cat1_latest_report_filed ||
        rec.cat5_latest_report_filed ||
        rec.periodic_latest_inspection ||
        rec.status_date ||
        rec.report_filing_date ||
        rec.filing_date
      const result =
        rec.inspection_result || rec.test_status || rec.result || rec.device_status || rec.status
      const status = rec.test_status || rec.inspection_status || rec.device_status || result || 'unknown'
      const defects =
        rec.defects === true ||
        rec.defects_exist === true ||
        String(result || '').toLowerCase().includes('fail') ||
        String(status || '').toLowerCase().includes('fail')
      const filingDate = asString(filingDateValue, '')
      const normalizedStatus = asString(status, 'unknown')
      const normalizedResult = asOptionalString(result)
      return {
        filingNumber: filingNumber ? String(filingNumber) : `${deviceNumber}-${filingDate || Date.now()}`,
        deviceId: asString(rec.device_number || rec.deviceid || deviceNumber, deviceNumber),
        filingType: asString(
          rec.test_type ||
            rec.inspection_type ||
            rec.filing_type ||
            rec.device_type ||
            rec.category,
          'inspection',
        ),
        filingDate,
        status: normalizedStatus,
        result: normalizedResult,
        defects,
        inspectorName: asOptionalString(rec.inspector_name || rec.inspector),
        inspectorCompany: asOptionalString(rec.inspector_company || rec.company),
        ...rec,
      }
    })
  }

  // Elevator violations (Open Data authoritative)
  async fetchDOBSafetyViolations(
    bin?: string | null,
    bbl?: string | null,
    deviceNumber?: string,
    limit = 5000,
    offset = 0
  ): Promise<Violation[]> {
    const filters: Record<string, string> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'violation_issue_date DESC',
    }
    if (bin) filters.bin = bin
    if (bbl) filters.bbl = bbl
    if (deviceNumber) filters.device_number = deviceNumber
    const records = await this.fetchDatasetRecords<DOBSafetyViolationRecord>(this.datasets.dobSafetyViolations, filters)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.violation_number || `DOB-SAF-${bin || bbl || 'unknown'}-${rec.violation_issue_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DOB',
      issueDate: asNullableString(rec.violation_issue_date || rec.issue_date),
      description: asString(rec.violation_remarks || rec.violation_type || rec.description, ''),
      status: asString(rec.violation_status || rec.status, 'open'),
      cureByDate: asNullableString(rec.cycle_end_date),
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number),
      category: 'violation',
      ...rec,
    }))
  }

  async fetchElevatorActiveViolations(
    bin?: string | null,
    deviceNumber?: string,
    limit = 5000,
    offset = 0
  ): Promise<Violation[]> {
    const filters: Record<string, string> = { $limit: String(limit), $offset: String(offset) }
    if (bin) filters.bin = bin
    if (deviceNumber) filters.device_number = deviceNumber
    const records = await this.fetchDatasetRecords(this.datasets.elevatorViolationsActive, filters)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.violation_number ||
          rec.summons_number ||
          `ELV-ACT-${bin || deviceNumber || 'unknown'}-${rec.issue_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DOB',
      issueDate: asNullableString(rec.violation_issue_date || rec.issue_date),
      description: asString(rec.violation_description || rec.description || rec.violation_type, ''),
      status: asString(rec.violation_status || rec.status, 'open'),
      cureByDate: asNullableString(rec.cure_date || rec.respond_by_date),
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number || deviceNumber),
      category: 'violation',
      ...rec,
    }))
  }

  async fetchElevatorHistoricViolations(
    bin?: string | null,
    deviceNumber?: string,
    limit = 5000,
    offset = 0
  ): Promise<Violation[]> {
    const filters: Record<string, string> = { $limit: String(limit), $offset: String(offset) }
    if (bin) filters.bin = bin
    if (deviceNumber) filters.device_number = deviceNumber
    const records = await this.fetchDatasetRecords(this.datasets.elevatorViolationsHistoric, filters)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.violation_number ||
          rec.summons_number ||
          `ELV-HIST-${bin || deviceNumber || 'unknown'}-${rec.issue_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DOB',
      issueDate: asNullableString(rec.issue_date || rec.violation_issue_date || rec.issue_date),
      description: asString(rec.description || rec.violation_description || rec.violation_type, ''),
      status: asString(rec.violation_status || rec.status || (rec.disposition_date ? 'closed' : 'open'), 'open'),
      cureByDate: asNullableString(rec.cure_date),
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number || deviceNumber),
      category: 'violation',
      ...rec,
    }))
  }

  async fetchElevatorComplaints(
    bin?: string | null,
    deviceNumber?: string,
    limit = 5000,
    offset = 0
  ): Promise<Violation[]> {
    const filters: Record<string, string> = { $limit: String(limit), $offset: String(offset) }
    if (bin) filters.bin = bin
    if (deviceNumber) filters.device_number = deviceNumber
    const records = await this.fetchDatasetRecords(this.datasets.elevatorComplaints, filters)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.complaint_number ||
          rec.complaintid ||
          `ELV-COMP-${bin || deviceNumber || 'unknown'}-${rec.received_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DOB',
      issueDate: asNullableString(rec.received_date || rec.issue_date),
      description: asString(
        rec.complaint_category || rec.major_category || rec.description || 'Elevator complaint',
        'Elevator complaint',
      ),
      status: asString(rec.status || rec.complaint_status, 'open'),
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number || deviceNumber),
      category: 'complaint',
      ...rec,
    }))
  }

  async fetchDOBViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords<DOBViolationRecord>(this.datasets.dobViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
      $order: 'issue_date DESC',
    })
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.isn_dob_bis_viol || rec.violation_number || rec.violationid || `DOB-${bin}-${rec.issue_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DOB',
      issueDate: asNullableString(rec.issue_date || rec.violation_date),
      description: asString(rec.violation_description || rec.description, ''),
      status: rec.disposition_date ? 'closed' : 'open',
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number),
      category: 'violation',
      ...rec,
    }))
  }

  async fetchDOBActiveViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords<DOBActiveViolationRecord>(this.datasets.dobActiveViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      violationNumber: asString(rec.isn_dob_bis_viol || rec.violation_number || `DOB-${bin}-${rec.issue_date || Date.now()}`),
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DOB',
      issueDate: asNullableString(rec.issue_date || rec.violation_date),
      description: asString(rec.violation_description || rec.description, ''),
      status: 'open',
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number),
      category: 'violation',
      ...rec,
    }))
  }

  async fetchDOBECBViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords<DOBECBViolationRecord>(this.datasets.dobEcbViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.ecb_violation_number || rec.summons_number || `ECB-${bin}-${rec.violation_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DOB',
      issueDate: asNullableString(rec.violation_date || rec.issue_date),
      description: asString(rec.violation_description || rec.description, ''),
      status: asString(rec.hearing_status || rec.status, 'open'),
      cureByDate: asNullableString(rec.cure_date),
      severityScore: undefined,
      deviceNumber: asNullableString(rec.device_number),
      category: 'violation',
      ...rec,
    }))
  }

  async fetchHPDViolations(bbl: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.hpdViolations, {
      bbl,
      $limit: String(limit),
      $offset: String(offset),
      $order: 'inspectiondate DESC',
    })
    return (records || []).map((rec) => ({
      violationNumber: asString(rec.violationid || rec.orderid || `HPD-${bbl}-${rec.inspectiondate || Date.now()}`),
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'HPD',
      issueDate: asNullableString(rec.novissueddate || rec.inspectiondate),
      description: asString(rec.novdescription || rec.description, ''),
      status: asString(rec.violationstatus || rec.currentstatus, 'open'),
      cureByDate: null,
      severityScore: rec.class === 'C' ? 5 : rec.class === 'B' ? 3 : 1,
      deviceNumber: null,
      category: 'violation',
      ...rec,
    }))
  }

  async fetchHPDComplaints(bbl: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.hpdComplaints, {
      bbl,
      $limit: String(limit),
      $offset: String(offset),
      $order: 'received_date DESC',
    })
    return (records || []).map((rec) => ({
      violationNumber: asString(rec.complaintid || `HPD-C-${bbl}-${rec.receiveddate || Date.now()}`),
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'HPD',
      issueDate: asNullableString(rec.receiveddate || rec.createddate),
      description: asString(
        rec.majorcategory && rec.minorcategory
          ? `${rec.majorcategory} - ${rec.minorcategory}`
          : rec.majorcategory || rec.minorcategory || 'HPD complaint',
        'HPD complaint',
      ),
      status: asString(rec.status, 'open'),
      cureByDate: null,
      severityScore: rec.majorcategory === 'HEAT/HOT WATER' ? 4 : rec.majorcategory === 'HAZARDOUS BUILDING' ? 5 : undefined,
      deviceNumber: null,
      category: 'complaint',
      ...rec,
    }))
  }

  async fetchHPDRegistrations(
    params: {
      bin?: string
      registrationId?: string
      boro?: string
      block?: string
      lot?: string
      limit?: number
      offset?: number
    } = {}
  ): Promise<HPDRegistrationRecord[]> {
    const { bin, registrationId, boro, block, lot, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'lastregistrationdate DESC',
    }
    if (bin) query.bin = bin
    if (registrationId) query.registrationid = registrationId
    if (boro) query.boro = boro
    if (block) query.block = block
    if (lot) query.lot = lot

    const records = await this.fetchDatasetRecords<HPDRegistrationRecord>(this.datasets.hpdRegistrations, query)
    return records
  }

  async fetchBedbugReporting(
    bin?: string,
    bbl?: string,
    limit = 5000,
    offset = 0
  ): Promise<BedbugReportRecord[]> {
    const params: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'filing_date DESC',
    }
    if (bin) params.bin = bin
    if (bbl) params.bbl = bbl
    const records = await this.fetchDatasetRecords<BedbugReportRecord>(this.datasets.bedbugReporting, params)
    return records
  }

  async fetchFDNYViolations(
    params: {
      bin?: string | null
      block?: string | null
      lot?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<Violation[]> {
    const { bin, block, lot, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'violation_date DESC',
    }
    if (block || lot) {
      if (block) query.violation_location_block_no = block
      if (lot) query.violation_location_lot_no = lot
    } else if (bin) {
      query.respondent_address_or_facility_number_for_fdny_and_dob_tickets = bin
    }

    const records = await this.fetchDatasetRecords(this.datasets.fdnyViolations, query)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.violation_id ||
          rec.summons_number ||
          `FDNY-${bin || block || 'unknown'}-${rec.inspection_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'FDNY',
      issueDate: asNullableString(rec.violation_date || rec.inspection_date || rec.issue_date),
      description: asString(rec.violation_description || rec.description, ''),
      status: asString(rec.compliance_status || rec.violation_status || rec.status, 'open'),
      cureByDate: asNullableString(rec.cure_date || rec.hearing_date),
      severityScore: rec.violation_level === 'IMMEDIATELY HAZARDOUS' ? 5 : undefined,
      deviceNumber: null,
      category: 'violation',
      ...rec,
    }))
  }

  async fetchIndoorEnvironmentalComplaints(
    bin?: string | null,
    limit = 5000,
    offset = 0
  ): Promise<Violation[]> {
    if (!bin) return []
    const records = await this.fetchDatasetRecords(this.datasets.indoorEnvironmentalComplaints, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      violationNumber: asString(rec.complaint_number || rec.unique_key || `DOHMH-IEC-${bin}-${rec.created_date || Date.now()}`),
      bin: rec.bin ? String(rec.bin) : bin,
      agency: 'DOHMH',
      issueDate: asNullableString(rec.created_date || rec.received_date),
      description: asString(
        rec.descriptor ||
          rec.complaint_type ||
          rec.incident_address ||
          rec.complaint_description ||
          'Indoor environmental complaint',
        'Indoor environmental complaint',
      ),
      status: asString(rec.status, 'open'),
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: null,
      category: 'complaint',
      ...rec,
    }))
  }

  async fetchAsbestosViolations(
    params: {
      bin?: string | null
      block?: string | null
      lot?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<Violation[]> {
    const { bin, block, lot, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'violation_date DESC',
    }
    if (block || lot) {
      if (block) query.violation_location_block_no = block
      if (lot) query.violation_location_lot_no = lot
    } else if (bin) {
      query.respondent_address_or_facility_number_for_fdny_and_dob_tickets = bin
    }

    const records = await this.fetchDatasetRecords(this.datasets.asbestosViolations, query)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.violation_id ||
          rec.case_number ||
          rec.ticket_number ||
          `ASB-${bin || block || 'unknown'}-${rec.violation_date || rec.issue_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DEP',
      issueDate: asNullableString(rec.violation_date || rec.issue_date || rec.hearing_date),
      description: asString(rec.violation_description || rec.violation_code || rec.description, ''),
      status: asString(rec.compliance_status || rec.hearing_status || rec.status, 'open'),
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: null,
      category: 'violation',
      ...rec,
    }))
  }

  async fetchBackflowPreventionViolations(
    params: {
      bin?: string | null
      block?: string | null
      lot?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<Violation[]> {
    const { bin, block, lot, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'violation_date DESC',
    }
    if (block || lot) {
      if (block) query.violation_location_block_no = block
      if (lot) query.violation_location_lot_no = lot
    } else if (bin) {
      query.respondent_address_or_facility_number_for_fdny_and_dob_tickets = bin
    }

    const records = await this.fetchDatasetRecords(this.datasets.backflowPreventionViolations, query)
    return (records || []).map((rec) => ({
      violationNumber: asString(
        rec.ticket_number ||
          rec.violation_id ||
          `BACKFLOW-${bin || block || 'unknown'}-${rec.violation_date || rec.issue_date || Date.now()}`,
      ),
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DEP',
      issueDate: asNullableString(rec.violation_date || rec.issue_date || rec.hearing_date),
      description: asString(rec.violation_description || rec.violation_details || rec.charge_1_code_description, ''),
      status: asString(rec.compliance_status || rec.hearing_status || rec.status, 'open'),
      cureByDate: asNullableString(rec.hearing_date),
      severityScore: undefined,
      deviceNumber: null,
      category: 'violation',
      ...rec,
    }))
  }

  private async fetchDatasetRecords<T extends NYCOpenDataRecord = NYCOpenDataRecord>(
    datasetId: string,
    params: Record<string, string | undefined>,
  ): Promise<T[]> {
    const url = this.buildUrl(datasetId, params)
    const rawRecords = await this.makeRequest<T[]>(url)
    const records = (Array.isArray(rawRecords) ? rawRecords : []) as T[]
    return this.ensureAllDatasetColumns(datasetId, records)
  }

  async fetchSidewalkViolationsByBBL(
    bbl: string,
    limit = 5000,
    offset = 0
  ): Promise<SidewalkViolationRecord[]> {
    const records = await this.fetchDatasetRecords<SidewalkViolationRecord>(this.datasets.sidewalkViolations, {
      bblid: bbl,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchDOBComplaints(bin: string, limit = 5000, offset = 0): Promise<DOBComplaintRecord[]> {
    const records = await this.fetchDatasetRecords<DOBComplaintRecord>(this.datasets.dobComplaints, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchDOBNowApprovedPermits(
    params: {
      bin?: string | null
      bbl?: string | null
      block?: string | null
      lot?: string | null
      jobFilingNumber?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<DOBNowJobFilingRecord[]> {
    const { bin, bbl, block, lot, jobFilingNumber, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin = bin
    if (bbl) query.bbl = bbl
    if (block) query.block = block
    if (lot) query.lot = lot
    if (jobFilingNumber) query.job_filing_number = jobFilingNumber

    const records = await this.fetchDatasetRecords<DOBNowJobFilingRecord>(this.datasets.dobNowApprovedPermits, query)
    return records
  }

  async fetchDOBNowJobFilings(
    params: {
      bin?: string | null
      bbl?: string | null
      jobFilingNumber?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<DOBNowJobFilingRecord[]> {
    const { bin, bbl, jobFilingNumber, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin = bin
    if (bbl) query.bbl = bbl
    if (jobFilingNumber) query.job_filing_number = jobFilingNumber

    const records = await this.fetchDatasetRecords<DOBNowJobFilingRecord>(this.datasets.dobNowJobFilings, query)
    return records
  }

  async fetchDOBNowSafetyFacadeFilings(
    params: {
      bin?: string | null
      controlNumber?: string | null
      trNumber?: string | null
      sequenceNumber?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<SafetyFacadeFilingRecord[]> {
    const { bin, controlNumber, trNumber, sequenceNumber, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin = bin
    if (controlNumber) query.control_no = controlNumber
    if (trNumber) query.tr6_no = trNumber
    if (sequenceNumber) query.sequence_no = sequenceNumber

    const records = await this.fetchDatasetRecords<SafetyFacadeFilingRecord>(this.datasets.dobNowSafetyFacade, query)
    return this.fillMissingColumns(records, DOB_NOW_SAFETY_FACADE_COLUMNS)
  }

  async fetchDOBNowSafetyBoilerFilings(
    params: {
      bin?: string | null
      boilerId?: string | null
      trackingNumber?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<SafetyBoilerFilingRecord[]> {
    const { bin, boilerId, trackingNumber, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin_number = String(bin)
    if (boilerId) query.boiler_id = boilerId
    if (trackingNumber) query.tracking_number = trackingNumber

    const records = await this.fetchDatasetRecords<SafetyBoilerFilingRecord>(this.datasets.dobNowSafetyBoiler, query)
    return this.fillMissingColumns(records, DOB_NOW_SAFETY_BOILER_COLUMNS)
  }

  async fetchDOBPermitIssuanceOld(
    params: {
      bin?: string | null
      bbl?: string | null
      block?: string | null
      lot?: string | null
      borough?: string | null
      jobNumber?: string | null
      permitNumber?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<DOBPermitIssuanceRecord[]> {
    const { bin, bbl, jobNumber, permitNumber, limit = 5000, offset = 0 } = params
    let { block, lot, borough } = params

    if ((!block || !lot || !borough) && bbl) {
      const digits = bbl.replace(/\D+/g, '')
      if (digits.length === 10) {
        borough = borough || digits[0]
        block = block || digits.slice(1, 6)
        lot = lot || digits.slice(6)
      }
    }

    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin__ = bin
    if (borough) query.borough = borough
    if (block) query.block = block
    if (lot) query.lot = lot
    if (jobNumber) query.job__ = jobNumber
    if (permitNumber) query.permit_si_no = permitNumber

    const records = await this.fetchDatasetRecords<DOBPermitIssuanceRecord>(this.datasets.dobPermitIssuanceOld, query)
    return records
  }

  async fetchDOBJobApplications(
    params: {
      bin?: string | null
      bbl?: string | null
      block?: string | null
      lot?: string | null
      borough?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<DOBJobApplicationRecord[]> {
    const { bin, bbl, limit = 5000, offset = 0 } = params
    let { block, lot, borough } = params

    if ((!block || !lot || !borough) && bbl) {
      const digits = bbl.replace(/\D+/g, '')
      if (digits.length === 10) {
        borough = borough || digits[0]
        block = block || digits.slice(1, 6)
        lot = lot || digits.slice(6)
      }
    }

    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin__ = bin
    if (borough) query.borough = borough
    if (block) query.block = block
    if (lot) query.lot = lot

    return this.fetchDatasetRecords<DOBJobApplicationRecord>(this.datasets.dobJobApplications, query)
  }

  async fetchDOBElevatorPermitApplications(
    params: {
      bin?: string | null
      bbl?: string | null
      block?: string | null
      lot?: string | null
      jobFilingNumber?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<DOBElevatorPermitApplicationRecord[]> {
    const { bin, bbl, jobFilingNumber, limit = 5000, offset = 0 } = params
    let { block, lot } = params

    if ((!block || !lot) && bbl) {
      const digits = bbl.replace(/\D+/g, '')
      if (digits.length === 10) {
        block = block || digits.slice(1, 6)
        lot = lot || digits.slice(6)
      }
    }

    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) {
      query.bin = bin
    } else {
      if (block) query.block = block
      if (lot) query.lot = lot
    }
    if (jobFilingNumber) query.job_filing_number = jobFilingNumber

    return this.fetchDatasetRecords<DOBElevatorPermitApplicationRecord>(this.datasets.dobElevatorPermitApplications, query)
  }

  async fetchDOBCertificateOfOccupancyOld(
    bin: string,
    limit = 5000,
    offset = 0,
  ): Promise<DOBCertificateOfOccupancyRecord[]> {
    const records = await this.fetchDatasetRecords<DOBCertificateOfOccupancyRecord>(this.datasets.dobCertificateOfOccupancyOld, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchDOBCertificateOfOccupancyNow(
    bin: string,
    limit = 5000,
    offset = 0,
  ): Promise<DOBCertificateOfOccupancyRecord[]> {
    const records = await this.fetchDatasetRecords<DOBCertificateOfOccupancyRecord>(this.datasets.dobCertificateOfOccupancyNow, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchDEPWaterSewerPermits(
    params: {
      taxBlock?: string | null
      taxLot?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<WaterSewerRecord[]> {
    const { taxBlock, taxLot, limit = 5000, offset = 0 } = params
    const toDigits = (value?: string | null) => {
      const text = value ? String(value).trim() : ''
      const digits = text.replace(/\D+/g, '')
      return digits.length ? String(Number(digits)) : null
    }

    const propertyBlock = toDigits(taxLot) // propertyblock maps from tax_lot
    const propertyLot = toDigits(taxBlock) // propertylot maps from tax_block

    if (!propertyBlock || !propertyLot) return []

    const query: Record<string, string | undefined> = {
      propertyblock: propertyBlock,
      propertylot: propertyLot,
      $limit: String(limit),
      $offset: String(offset),
    }

    return this.fetchDatasetRecords<WaterSewerRecord>(this.datasets.waterSewer, query)
  }

  async fetchDEPWaterSewerPermitsOld(
    params: {
      taxBlock?: string | null
      taxLot?: string | null
      limit?: number
      offset?: number
    } = {}
  ): Promise<WaterSewerOldRecord[]> {
    const { taxBlock, taxLot, limit = 5000, offset = 0 } = params
    const toDigits = (value?: string | null) => {
      const text = value ? String(value).trim() : ''
      const digits = text.replace(/\D+/g, '')
      return digits.length ? String(Number(digits)) : null
    }

    const block = toDigits(taxBlock)
    const lot = toDigits(taxLot)

    if (!block || !lot) return []

    const query: Record<string, string | undefined> = {
      block,
      lot,
      $limit: String(limit),
      $offset: String(offset),
    }

    return this.fetchDatasetRecords<WaterSewerOldRecord>(this.datasets.waterSewerOld, query)
  }

  async fetchHeatSensorProgram(
    bin?: string,
    bbl?: string,
    limit = 5000,
    offset = 0
  ): Promise<HeatSensorProgramRecord[]> {
    const params: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) params.bin = bin
    if (bbl) params.bbl = bbl
    const records = await this.fetchDatasetRecords<HeatSensorProgramRecord>(this.datasets.heatSensorProgram, params)
    return records
  }

  private fillMissingColumns<T extends NYCOpenDataRecord>(rows: T[], columns: readonly string[]): T[] {
    if (!rows?.length) return rows
    return rows.map((row) => {
      const normalized: NYCOpenDataRecord = { ...row }
      for (const column of columns) {
        if (!(column in normalized)) {
          normalized[column] = null
        }
      }
      return normalized as T
    })
  }

  private async ensureAllDatasetColumns<T extends NYCOpenDataRecord>(
    datasetId: string,
    records: T[],
  ): Promise<T[]> {
    const rows = Array.isArray(records) ? records : []
    if (!rows.length) return rows

    const columns = await this.getDatasetColumns(datasetId)
    if (!columns || columns.length === 0) return rows

    return rows.map((row) => {
      const normalized: NYCOpenDataRecord = { ...row }
      for (const column of columns) {
        if (!(column in normalized)) {
          normalized[column] = null
        }
      }
      return normalized as T
    })
  }

  private async getDatasetColumns(datasetId: string): Promise<string[] | null> {
    if (this.datasetColumnsCache.has(datasetId)) {
      const cached = this.datasetColumnsCache.get(datasetId) || []
      return cached.length ? cached : null
    }

    try {
      const url = new URL(`api/views/${datasetId}`, this.baseUrlNormalized)
      const meta = await this.makeRequest<{ columns?: Array<{ fieldName?: string }> }>(url.toString())
      const columns =
        (meta?.columns || [])
          .map((col) => col.fieldName)
          .filter((name): name is string => Boolean(name)) || []
      this.datasetColumnsCache.set(datasetId, columns)
      return columns.length ? columns : null
    } catch (error) {
      logger.warn({ datasetId, error }, 'Failed to load NYC Open Data dataset columns')
      this.datasetColumnsCache.set(datasetId, [])
      return null
    }
  }

  private buildUrl(datasetId: string, params: Record<string, string | undefined>): string {
    const url = new URL(`resource/${datasetId}.json`, this.baseUrlNormalized)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value)
      }
    })
    return url.toString()
  }

  private async makeRequest<T>(url: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (this.apiKey) headers['X-App-Token'] = this.apiKey

    const config: RequestInit = {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.timeout),
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`NYC Open Data API error: ${response.status} ${errorText}`)
        }
        return (await response.json()) as T
      } catch (error) {
        lastError = error as Error
        if (attempt < this.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)))
          continue
        }
        throw error
      }
    }

    throw lastError || new Error('Unknown error in NYC Open Data API request')
  }
}

export class HPDClient {
  private baseUrl: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(config?: NYCAPIConfig) {
    this.baseUrl = config?.nycOpenDataBaseUrl || 'https://data.cityofnewyork.us/'
    this.timeout = config?.timeout || 30000
    this.retryAttempts = config?.retryAttempts || 3
    this.retryDelay = config?.retryDelay || 1000
  }

  async fetchViolations(bin: string): Promise<Violation[]> {
    try {
      const url = `${this.baseUrl}resource/wvxf-dwi5.json?bin=${bin}`
      const response = await this.makeRequest<Violation[]>(url)
      return Array.isArray(response) ? response : []
    } catch (error) {
      logger.error({ error, bin }, 'Failed to fetch HPD violations')
      throw error
    }
  }

  private async makeRequest<T>(url: string): Promise<T> {
    const config: RequestInit = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HPD API error: ${response.status} ${errorText}`)
        }
        return (await response.json()) as T
      } catch (error) {
        lastError = error as Error
        if (attempt < this.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)))
          continue
        }
        throw error
      }
    }
    throw lastError || new Error('Unknown error in HPD API request')
  }
}

export class FDNYClient {
  private baseUrl: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(config?: NYCAPIConfig) {
    this.baseUrl = config?.nycOpenDataBaseUrl || 'https://data.cityofnewyork.us/'
    this.timeout = config?.timeout || 30000
    this.retryAttempts = config?.retryAttempts || 3
    this.retryDelay = config?.retryDelay || 1000
  }

  async fetchViolations(bin: string): Promise<Violation[]> {
    try {
      const url = `${this.baseUrl}resource/avgm-ztsb.json?bin=${bin}`
      const response = await this.makeRequest<Violation[]>(url)
      return Array.isArray(response) ? response : []
    } catch (error) {
      logger.error({ error, bin }, 'Failed to fetch FDNY violations')
      throw error
    }
  }

  private async makeRequest<T>(url: string): Promise<T> {
    const config: RequestInit = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`FDNY API error: ${response.status} ${errorText}`)
        }
        return (await response.json()) as T
      } catch (error) {
        lastError = error as Error
        if (attempt < this.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)))
          continue
        }
        throw error
      }
    }
    throw lastError || new Error('Unknown error in FDNY API request')
  }
}

export function createNYCAPIClients(config?: NYCAPIConfig & { appToken?: string }) {
  return {
    dobNow: new DOBNowClient(config),
    nycOpenData: new NYCOpenDataClient(config),
    hpd: new HPDClient(config),
    fdny: new FDNYClient(config),
  }
}
