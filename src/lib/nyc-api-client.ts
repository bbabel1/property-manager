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
  dobSafetyViolations: string
  dobViolations: string
  dobActiveViolations: string
  dobEcbViolations: string
  dobComplaints: string
  bedbugReporting: string
  dobNowApprovedPermits: string
  dobPermitIssuanceOld: string
  dobCertificateOfOccupancyOld: string
  dobCertificateOfOccupancyNow: string
  dobNowSafetyBoiler: string
  dobNowSafetyFacade: string
  hpdViolations: string
  hpdComplaints: string
  hpdRegistrations: string
  fdnyViolations: string
  asbestosViolations: string
  sidewalkViolations: string
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
  dobSafetyViolations: '855j-jady', // DOB Safety Violations
  dobViolations: '3h2n-5cm9',
  dobActiveViolations: '6drr-tyq2',
  dobEcbViolations: '6bgk-3dad',
  dobComplaints: 'eabe-havv',
  bedbugReporting: 'wz6d-d3jb',
  dobNowApprovedPermits: 'rbx6-tga4',
  dobPermitIssuanceOld: 'ipu4-2q9a',
  dobCertificateOfOccupancyOld: 'bs8b-p36w',
  dobCertificateOfOccupancyNow: 'pkdm-hqz6',
  dobNowSafetyBoiler: '52dp-yji6',
  dobNowSafetyFacade: 'xubg-57si',
  hpdViolations: 'wvxf-dwi5',
  hpdComplaints: 'ygpa-z7cr',
  hpdRegistrations: 'tesw-yqqr',
  fdnyViolations: 'avgm-ztsb',
  asbestosViolations: 'r6c3-8mpt',
  sidewalkViolations: '6kbp-uz6m',
  heatSensorProgram: 'h4mf-f24e',
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
  [key: string]: unknown
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
    const records = await this.fetchDatasetRecords(this.datasets.elevatorDevices, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      deviceId: (rec.device_id || rec.deviceid || rec.device_number || rec.device_num || '').toString(),
      deviceNumber: (rec.device_number || rec.deviceid || rec.device_id || '').toString(),
      bin: rec.bin ? String(rec.bin) : rec.building_bin ? String(rec.building_bin) : null,
      deviceType: rec.device_type || rec.type || rec.device_category || 'Unknown',
      status: rec.status || rec.device_status || rec.operational_status || 'unknown',
      lastInspectionDate: rec.last_inspection_date || rec.inspection_date || null,
      nextInspectionDue: rec.next_inspection_due || rec.next_inspection_date || null,
      ...rec,
    }))
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
      $order: 'inspection_date DESC',
    }
    if (bin) filters.bin = bin
    const records = await this.fetchDatasetRecords(this.datasets.elevatorInspections, filters)
    return (records || []).map((rec) => {
      const filingNumber =
        rec.tracking_number ||
        rec.control_number ||
        rec.inspection_id ||
        rec.filing_number ||
        rec.test_id ||
        rec.id
      const filingDate = rec.inspection_date || rec.test_date || rec.filing_date
      const result = rec.inspection_result || rec.test_status || rec.result
      const status = rec.test_status || rec.inspection_status || result || 'unknown'
      const defects =
        rec.defects === true ||
        String(result || '').toLowerCase().includes('fail') ||
        String(status || '').toLowerCase().includes('fail')
      return {
        filingNumber: filingNumber ? String(filingNumber) : `${deviceNumber}-${filingDate || Date.now()}`,
        deviceId: rec.device_number || rec.deviceid || deviceNumber,
        filingType: rec.test_type || rec.inspection_type || rec.category || 'inspection',
        filingDate,
        status,
        result,
        defects,
        inspectorName: rec.inspector_name || rec.inspector || null,
        inspectorCompany: rec.inspector_company || rec.company || null,
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
    const records = await this.fetchDatasetRecords(this.datasets.dobSafetyViolations, filters)
    return (records || []).map((rec) => ({
      violationNumber:
        rec.violation_number || `DOB-SAF-${bin || bbl || 'unknown'}-${rec.violation_issue_date || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : bin || null,
      agency: 'DOB',
      issueDate: rec.violation_issue_date || rec.issue_date || null,
      description: rec.violation_remarks || rec.violation_type || rec.description || '',
      status: rec.violation_status || rec.status || 'open',
      cureByDate: rec.cycle_end_date || null,
      severityScore: undefined,
      deviceNumber: rec.device_number || null,
      ...rec,
    }))
  }

  async fetchDOBViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.dobViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
      $order: 'issue_date DESC',
    })
    return (records || []).map((rec) => ({
      violationNumber: rec.isn_dob_bis_viol || rec.violation_number || rec.violationid || `DOB-${bin}-${rec.issue_date || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DOB',
      issueDate: rec.issue_date || rec.violation_date || null,
      description: rec.violation_description || rec.description || '',
      status: rec.disposition_date ? 'closed' : 'open',
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: rec.device_number || null,
      ...rec,
    }))
  }

  async fetchDOBActiveViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.dobActiveViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      violationNumber: rec.isn_dob_bis_viol || rec.violation_number || `DOB-${bin}-${rec.issue_date || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DOB',
      issueDate: rec.issue_date || rec.violation_date || null,
      description: rec.violation_description || rec.description || '',
      status: 'open',
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: rec.device_number || null,
      ...rec,
    }))
  }

  async fetchDOBECBViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.dobEcbViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      violationNumber: rec.ecb_violation_number || rec.summons_number || `ECB-${bin}-${rec.violation_date || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DOB',
      issueDate: rec.violation_date || rec.issue_date || null,
      description: rec.violation_description || rec.description || '',
      status: rec.hearing_status || rec.status || 'open',
      cureByDate: rec.cure_date || null,
      severityScore: undefined,
      deviceNumber: rec.device_number || null,
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
      violationNumber: rec.violationid || rec.orderid || `HPD-${bbl}-${rec.inspectiondate || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'HPD',
      issueDate: rec.novissueddate || rec.inspectiondate || null,
      description: rec.novdescription || rec.description || '',
      status: rec.violationstatus || rec.currentstatus || 'open',
      cureByDate: null,
      severityScore: rec.class === 'C' ? 5 : rec.class === 'B' ? 3 : 1,
      deviceNumber: null,
      ...rec,
    }))
  }

  async fetchHPDComplaints(bbl: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.hpdComplaints, {
      bbl,
      $limit: String(limit),
      $offset: String(offset),
      $order: 'receiveddate DESC',
    })
    return (records || []).map((rec) => ({
      violationNumber: rec.complaintid || `HPD-C-${bbl}-${rec.receiveddate || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'HPD',
      issueDate: rec.receiveddate || rec.createddate || null,
      description:
        rec.majorcategory && rec.minorcategory
          ? `${rec.majorcategory} - ${rec.minorcategory}`
          : rec.majorcategory || rec.minorcategory || 'HPD complaint',
      status: rec.status || 'open',
      cureByDate: null,
      severityScore: rec.majorcategory === 'HEAT/HOT WATER' ? 4 : rec.majorcategory === 'HAZARDOUS BUILDING' ? 5 : undefined,
      deviceNumber: null,
      ...rec,
    }))
  }

  async fetchBedbugReporting(
    bin?: string,
    bbl?: string,
    limit = 5000,
    offset = 0
  ): Promise<any[]> {
    const params: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
      $order: 'filing_date DESC',
    }
    if (bin) params.bin = bin
    if (bbl) params.bbl = bbl
    const records = await this.fetchDatasetRecords(this.datasets.bedbugReporting, params)
    return records
  }

  async fetchFDNYViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.fdnyViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
      $order: 'inspection_date DESC',
    })
    return (records || []).map((rec) => ({
      violationNumber: rec.violation_id || rec.summons_number || `FDNY-${bin}-${rec.inspection_date || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'FDNY',
      issueDate: rec.inspection_date || rec.issue_date || null,
      description: rec.violation_description || rec.description || '',
      status: rec.violation_status || rec.status || 'open',
      cureByDate: rec.cure_date || null,
      severityScore: rec.violation_level === 'IMMEDIATELY HAZARDOUS' ? 5 : undefined,
      deviceNumber: null,
      ...rec,
    }))
  }

  async fetchAsbestosViolations(bin: string, limit = 5000, offset = 0): Promise<Violation[]> {
    const records = await this.fetchDatasetRecords(this.datasets.asbestosViolations, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return (records || []).map((rec) => ({
      violationNumber: rec.violation_id || rec.case_number || `ASB-${bin}-${rec.issue_date || Date.now()}`,
      bin: rec.bin ? String(rec.bin) : null,
      agency: 'DEP',
      issueDate: rec.issue_date || rec.violation_date || null,
      description: rec.violation_code || rec.description || '',
      status: rec.hearing_status || rec.status || 'open',
      cureByDate: null,
      severityScore: undefined,
      deviceNumber: null,
      ...rec,
    }))
  }

  private async fetchDatasetRecords(datasetId: string, params: Record<string, string | undefined>): Promise<any[]> {
    const url = this.buildUrl(datasetId, params)
    const rawRecords = await this.makeRequest<any[]>(url)
    const records = Array.isArray(rawRecords) ? rawRecords : []
    return this.ensureAllDatasetColumns(datasetId, records)
  }

  async fetchSidewalkViolationsByBBL(
    bbl: string,
    limit = 5000,
    offset = 0
  ): Promise<any[]> {
    const records = await this.fetchDatasetRecords(this.datasets.sidewalkViolations, {
      bblid: bbl,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchDOBComplaints(bin: string, limit = 5000, offset = 0): Promise<any[]> {
    const records = await this.fetchDatasetRecords(this.datasets.dobComplaints, {
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
  ): Promise<any[]> {
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

    const records = await this.fetchDatasetRecords(this.datasets.dobNowApprovedPermits, query)
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
  ): Promise<any[]> {
    const { bin, controlNumber, trNumber, sequenceNumber, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin = bin
    if (controlNumber) query.control_no = controlNumber
    if (trNumber) query.tr6_no = trNumber
    if (sequenceNumber) query.sequence_no = sequenceNumber

    const records = await this.fetchDatasetRecords(this.datasets.dobNowSafetyFacade, query)
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
  ): Promise<any[]> {
    const { bin, boilerId, trackingNumber, limit = 5000, offset = 0 } = params
    const query: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) query.bin_number = String(bin)
    if (boilerId) query.boiler_id = boilerId
    if (trackingNumber) query.tracking_number = trackingNumber

    const records = await this.fetchDatasetRecords(this.datasets.dobNowSafetyBoiler, query)
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
  ): Promise<any[]> {
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

    const records = await this.fetchDatasetRecords(this.datasets.dobPermitIssuanceOld, query)
    return records
  }

  async fetchDOBCertificateOfOccupancyOld(bin: string, limit = 5000, offset = 0): Promise<any[]> {
    const records = await this.fetchDatasetRecords(this.datasets.dobCertificateOfOccupancyOld, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchDOBCertificateOfOccupancyNow(bin: string, limit = 5000, offset = 0): Promise<any[]> {
    const records = await this.fetchDatasetRecords(this.datasets.dobCertificateOfOccupancyNow, {
      bin,
      $limit: String(limit),
      $offset: String(offset),
    })
    return records
  }

  async fetchHeatSensorProgram(
    bin?: string,
    bbl?: string,
    limit = 5000,
    offset = 0
  ): Promise<any[]> {
    const params: Record<string, string | undefined> = {
      $limit: String(limit),
      $offset: String(offset),
    }
    if (bin) params.bin = bin
    if (bbl) params.bbl = bbl
    const records = await this.fetchDatasetRecords(this.datasets.heatSensorProgram, params)
    return records
  }

  private fillMissingColumns(rows: any[], columns: readonly string[]): any[] {
    if (!rows?.length) return rows
    return rows.map((row) => {
      const normalized = { ...row }
      for (const column of columns) {
        if (!(column in normalized)) {
          normalized[column] = null
        }
      }
      return normalized
    })
  }

  private async ensureAllDatasetColumns(datasetId: string, records: any[]): Promise<any[]> {
    const rows = Array.isArray(records) ? records : []
    if (!rows.length) return rows

    const columns = await this.getDatasetColumns(datasetId)
    if (!columns || columns.length === 0) return rows

    return rows.map((row) => {
      const normalized = { ...row }
      for (const column of columns) {
        if (!(column in normalized)) {
          normalized[column] = null
        }
      }
      return normalized
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
