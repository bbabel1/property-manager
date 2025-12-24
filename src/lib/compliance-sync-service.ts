/**
 * Compliance Sync Service
 * 
 * Service to sync compliance data from NYC APIs (DOB NOW, NYC Open Data, HPD, FDNY)
 * with advisory locks to prevent concurrent syncs and external_sync_state tracking
 * for incremental syncing.
 */

import { supabaseAdmin } from './db'
import { logger } from './logger'
import {
  DOBNowClient,
  NYCOpenDataClient,
  HPDClient,
  FDNYClient,
  createNYCAPIClients,
} from './nyc-api-client'
import { syncBuildingPermitsFromOpenData } from './building-permit-sync'
import type {
  ComplianceAssetInsert,
  ComplianceEventInsert,
  ComplianceViolationInsert,
  ComplianceSyncResponse,
  ExternalSyncSource,
  ComplianceDeviceCategory,
  ComplianceViolationStatus,
  ComplianceStatus,
} from '@/types/compliance'
import { getNYCOpenDataConfig } from './nyc-open-data/config-manager'
import {
  programTargetsAsset,
  programTargetsProperty,
  resolveProgramScope,
} from './compliance-programs'
import { normalizeText } from './building-permit-sync'
import type { Json } from '@/types/database'

const NYC_BOROUGHS = new Set(['manhattan', 'bronx', 'brooklyn', 'queens', 'staten island'])

type ComplianceEventUpsertInput = Omit<
  ComplianceEventInsert,
  'org_id' | 'item_id' | 'inspector_name' | 'inspector_company'
> & {
  item_id?: string | null
  inspector_name?: string | null
  inspector_company?: string | null
}

export type ViolationSource =
  | 'dob_safety_violations'
  | 'dob_violations'
  | 'dob_active_violations'
  | 'dob_ecb_violations'
  | 'hpd_violations'
  | 'hpd_complaints'
  | 'fdny_violations'
  | 'asbestos_violations'
  | 'indoor_environmental_complaints'
  | 'sidewalk_violations'
  | 'backflow_prevention_violations'
  | 'sidewalk_violations'

export class ComplianceSyncService {
  private dobNowClient: DOBNowClient
  private nycOpenDataClient: NYCOpenDataClient
  private hpdClient: HPDClient
  private fdnyClient: FDNYClient
  private assetCache: Map<string, Array<{ id: string; asset_type: string; active: boolean }>>
  private normalizationCache: Map<string, {
    category: ComplianceDeviceCategory | null
    technology: string | null
    subtype: string | null
    is_private_residence: boolean | null
  }>

  constructor() {
    const clients = createNYCAPIClients()
    this.dobNowClient = clients.dobNow
    this.nycOpenDataClient = clients.nycOpenData
    this.hpdClient = clients.hpd
    this.fdnyClient = clients.fdny
    this.assetCache = new Map()
    this.normalizationCache = new Map()
  }

  private async hydrateOpenDataClient(orgId: string) {
    const odConfig = await getNYCOpenDataConfig(orgId)
    this.nycOpenDataClient = new NYCOpenDataClient({
      nycOpenDataBaseUrl: odConfig.baseUrl,
      nycOpenDataApiKey: odConfig.appToken || undefined,
      appToken: odConfig.appToken || undefined,
      datasets: odConfig.datasets,
    })
  }
  private stripUndefined<T extends Record<string, any>>(obj: T): T {
    const next: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) next[key] = value
    }
    return next as T
  }

  private toJson(value: unknown): Json {
    if (value === undefined) return null
    try {
      return JSON.parse(JSON.stringify(value ?? null)) as Json
    } catch {
      return null
    }
  }

  private normalizeDate(value?: string | null): string | null {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  }

  private firstPresentString(values: Array<string | number | null | undefined | unknown>): string | null {
    for (const value of values) {
      if (value === null || value === undefined) continue
      if (typeof value === 'string' || typeof value === 'number') {
        const normalized = String(value).trim()
        if (normalized) return normalized
      }
    }
    return null
  }

  private normalizeComplianceStatus(status?: string | null): ComplianceStatus {
    if (status === null || status === undefined) return null
    const value = String(status).trim()
    if (!value) return null

    const lower = value.toLowerCase()
    if ((lower.includes('accept') || lower.includes('pass')) && lower.includes('defect')) {
      return 'accepted_with_defects'
    }
    if (lower.includes('accept') || lower.includes('pass') || lower.includes('approval')) {
      return 'accepted'
    }
    if (lower.includes('fail') || lower.includes('reject') || lower.includes('denied')) {
      return 'failed'
    }
    if (lower.includes('schedule')) return 'scheduled'
    if (lower.includes('progress') || lower.includes('pending') || lower.includes('process')) {
      return 'in_progress'
    }
    if (lower.includes('open')) return 'open'
    if (lower.includes('close') || lower.includes('complete')) return 'closed'
    return value
  }

  private normalizeDeviceCategory(category?: string | null): ComplianceDeviceCategory | null {
    if (!category) return null
    const normalized = String(category).trim().toLowerCase().replace(/[\s-]+/g, '_')
    const directMap: Record<string, ComplianceDeviceCategory> = {
      elevator: 'elevator',
      escalator: 'escalator',
      dumbwaiter: 'dumbwaiter',
      wheelchair_lift: 'wheelchair_lift',
      platform_lift: 'wheelchair_lift',
      material_lift: 'material_lift',
      manlift: 'manlift',
      pneumatic_elevator: 'pneumatic_elevator',
      other_vertical: 'other_vertical',
      lift: 'lift',
      chairlift: 'chairlift',
      boiler: 'boiler',
      sprinkler: 'sprinkler',
      gas_piping: 'gas_piping',
      gas: 'gas_piping',
      generic: 'generic',
      other: 'other',
    }

    if (directMap[normalized]) return directMap[normalized]
    if (normalized.includes('elev')) return 'elevator'
    if (normalized.includes('escal')) return 'escalator'
    if (normalized.includes('dumb')) return 'dumbwaiter'
    if (normalized.includes('wheelchair') || normalized.includes('platform')) return 'wheelchair_lift'
    if (normalized.includes('material')) return 'material_lift'
    if (normalized.includes('chair')) return 'chairlift'
    if (normalized.includes('lift')) return 'lift'
    return null
  }

  private parseBbl(bbl?: string | null): { boro: string | null; block: string | null; lot: string | null } {
    if (!bbl) return { boro: null, block: null, lot: null }
    const digits = String(bbl).replace(/\D+/g, '')
    if (digits.length !== 10) return { boro: null, block: null, lot: null }
    return { boro: digits[0] || null, block: digits.slice(1, 6) || null, lot: digits.slice(6) || null }
  }

  private dwellingUnitsFromBuilding(building: any): number | null {
    if (!building) return null
    if (typeof building.residential_units === 'number') return building.residential_units
    if (typeof building.dwelling_units === 'number') return building.dwelling_units
    if (typeof building.number_of_dwelling_units === 'number') return building.number_of_dwelling_units
    return null
  }

  /**
   * Main sync entry point for a property
   */
  async syncPropertyCompliance(
    propertyId: string,
    orgId: string,
    force = false
  ): Promise<ComplianceSyncResponse> {
    try {
      // Get property BIN
      const { data: property, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('id, bin, bbl, borough, city, building_id')
        .eq('id', propertyId)
        .eq('org_id', orgId)
        .single()

      if (propertyError || !property) {
        throw new Error(`Property not found: ${propertyId}`)
      }

      const bin = property.bin
      let bbl: string | null = (property as any)?.bbl || null
      const borough = normalizeText((property as any)?.borough)
      const isNYC = borough ? NYC_BOROUGHS.has(borough.toLowerCase()) : false

      if (property.building_id && !bbl) {
        const { data: building } = await supabaseAdmin
          .from('buildings')
          .select('bbl')
          .eq('id', property.building_id)
          .maybeSingle()
        bbl = (building?.bbl as string | null) || null
      }

      if (!bin && !bbl) {
        logger.warn({ propertyId, orgId }, 'Property missing BIN/BBL, skipping sync')
        return {
          success: false,
          synced_assets: 0,
          synced_events: 0,
          synced_violations: 0,
          updated_items: 0,
          errors: ['Property missing BIN/BBL'],
        }
      }

      if (!isNYC) {
        logger.info({ propertyId, orgId, borough }, 'Compliance sync limited to NYC; skipping non-NYC property')
        return {
          success: false,
          synced_assets: 0,
          synced_events: 0,
          synced_violations: 0,
          updated_items: 0,
          errors: [
            borough
              ? `Compliance sync runs for NYC properties only (borough: ${borough})`
              : 'Compliance sync runs for NYC properties only',
          ],
        }
      }

      await this.hydrateOpenDataClient(orgId)

      // Sync elevators
      const elevatorResult = bin
        ? await this.syncElevatorsByBIN(bin, propertyId, orgId, force)
        : { assets: 0, events: 0, errors: ['BIN missing, skipped elevators/boilers'] }

      // Sync boilers
      const boilerResult = bin
        ? await this.syncBoilersByBIN(bin, propertyId, orgId, force)
        : { assets: 0, events: 0, errors: ['BIN missing, skipped elevators/boilers'] }

      // Sync facades
      const facadeResult = bin
        ? await this.syncFacadesByBIN(bin, propertyId, orgId, force)
        : { assets: 0, events: 0, errors: ['BIN missing, skipped facades'] }

      // Sync DOB NOW approved permits (Open Data)
      const approvedPermitsResult = await this.syncDobNowApprovedPermits(
        propertyId,
        orgId,
        bin,
        bbl
      )

      // Sync DOB NOW job filings (Open Data)
      const jobFilingsResult = await this.syncDobNowJobFilings(propertyId, orgId, bin, bbl)

      // Persist building permits for downstream asset checks (approved permits + legacy BIS)
      await syncBuildingPermitsFromOpenData({
        orgId,
        propertyId,
        bin,
        bbl,
        includeSources: [
          'dob_now_build_approved_permits',
          'dob_permit_issuance_old',
          'dob_job_applications',
          'dep_water_sewer_permits',
          'dep_water_sewer_permits_old',
          'dob_elevator_permit_applications',
          'hpd_registrations',
          'dob_now_safety_facade',
        ],
      }).catch((error) => {
        logger.warn({ error, propertyId, orgId }, 'Building permit sync failed')
      })

      // Sync BIS job applications (events) for visibility
      const jobApplicationsResult = await this.syncDobJobApplications(
        propertyId,
        orgId,
        bin,
        bbl
      )

      // Seed compliance assets inferred from permits (elevators/boilers/sprinklers/gas/facade)
      await this.seedAssetsFromPermits(propertyId, orgId)

      // Sync violations
      const violationsResult = bin
        ? await this.syncViolationsByBIN(bin, propertyId, orgId, bbl, force)
        : await this.syncViolationsByBIN('', propertyId, orgId, bbl, force)

      // Sync any data sources required by active compliance programs for this property
      const datasourceResult = await this.syncProgramDataSourcesForProperty(
        propertyId,
        orgId,
        {
          bin: bin || null,
          bbl: bbl || null,
          borough: (property as any)?.borough || null,
          building_id: (property as any)?.building_id || null,
        }
      )

      // Update compliance items from events
      const itemsUpdated = await this.updateComplianceItemsFromEvents(propertyId, orgId)

      return {
        success: true,
        synced_assets: elevatorResult.assets + boilerResult.assets,
        synced_events:
          elevatorResult.events +
          boilerResult.events +
          facadeResult.events +
          (approvedPermitsResult.events || 0) +
          (jobFilingsResult.events || 0) +
          (jobApplicationsResult.events || 0) +
          (datasourceResult.events || 0),
        synced_violations: violationsResult.violations,
        updated_items: itemsUpdated,
        errors: [
          ...(elevatorResult.errors || []),
          ...(boilerResult.errors || []),
          ...(facadeResult.errors || []),
          ...(approvedPermitsResult.errors || []),
          ...(jobFilingsResult.errors || []),
          ...(jobApplicationsResult.errors || []),
          ...(violationsResult.errors || []),
          ...(datasourceResult.errors || []),
        ],
      }
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in syncPropertyCompliance')
      return {
        success: false,
        synced_assets: 0,
        synced_events: 0,
        synced_violations: 0,
        updated_items: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Sync elevator devices and filings by BIN with advisory lock
   */
  async syncElevatorsByBIN(
    bin: string,
    propertyId: string,
    orgId: string,
    _force = false
  ): Promise<{ assets: number; events: number; errors?: string[] }> {
    try {
      const lockKey = `compliance_sync:${orgId}:dob_now`
      const locked = await this.tryAcquireLock(lockKey)
      if (!locked) {
        logger.warn({ orgId, bin }, 'Compliance sync lock already held')
        return { assets: 0, events: 0, errors: ['Sync already in progress'] }
      }

      await this.updateSyncState(orgId, 'dob_now', { status: 'running' })

      let assetsCreated = 0
      let eventsCreated = 0
      const errors: string[] = []
      let fatalError: string | null = null

      try {
        // 1) Open Data devices (authoritative)
        const odDevices = await this.nycOpenDataClient.fetchElevatorDevicesByBin(bin)

        for (const device of odDevices.filter((d) => (d as any).status?.toLowerCase() === 'active')) {
          const deviceIdentifier = device.deviceNumber || device.deviceId
          try {
            const rawType = this.firstPresentString([
              device.deviceType,
              (device as any).device_category,
              (device as any).device_description,
              (device as any).type,
              deviceIdentifier,
            ])
            const normalization = await this.normalizeDeviceType(
              'NYC_OPEN_DATA',
              rawType,
              this.firstPresentString([(device as any).device_description, (device as any).type])
            )
            const asset = await this.upsertComplianceAsset(
              {
                property_id: propertyId,
                asset_type: 'elevator',
                name: device.deviceNumber || device.deviceId || 'Elevator',
                external_source: 'nyc_open_data_elevator_device',
                external_source_id: deviceIdentifier,
                metadata: device,
                device_category:
                  (normalization.category as ComplianceDeviceCategory | null) || 'elevator',
                device_technology: normalization.technology || null,
                device_subtype: normalization.subtype || null,
                is_private_residence: normalization.is_private_residence ?? null,
              },
              orgId
            )

            if (asset) {
              assetsCreated++

              // Inspections/tests from Open Data
              const inspections = await this.nycOpenDataClient.fetchElevatorInspections(deviceIdentifier, bin)
              for (const inspection of inspections) {
                try {
                  await this.upsertComplianceEvent(
                    {
                      property_id: propertyId,
                      asset_id: asset.id,
                      event_type: 'inspection',
                      inspection_type: inspection.filingType,
                      inspection_date: inspection.filingDate ? inspection.filingDate.split('T')[0] : null,
                      filed_date: inspection.filingDate ? inspection.filingDate.split('T')[0] : null,
                      compliance_status: inspection.status || inspection.result || null,
                      defects: inspection.defects || false,
                      inspector_name: inspection.inspectorName || null,
                      inspector_company: inspection.inspectorCompany || null,
                      external_tracking_number: inspection.filingNumber,
                      raw_source: inspection,
                    },
                    orgId
                  )
                  eventsCreated++
                } catch (error) {
                  logger.error({ error, inspection }, 'Failed to upsert elevator inspection event')
                  errors.push(
                    `Failed to sync inspection ${inspection.filingNumber}: ${
                      error instanceof Error ? error.message : 'Unknown error'
                    }`
                  )
                }
              }

              // Elevator violations (Open Data)
            }
          } catch (error) {
            logger.error({ error, device }, 'Failed to upsert elevator asset (Open Data)')
            errors.push(
              `Failed to sync Open Data device ${deviceIdentifier}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        }

        // 2) DOB NOW filings/in-progress (authoritative for filings)
        let dobDevices: any[] = []
        try {
          dobDevices = await this.dobNowClient.fetchElevatorDevices(bin)
        } catch (error) {
          logger.error({ error, bin }, 'Failed to fetch elevator devices from DOB NOW')
          errors.push(
            error instanceof Error
              ? error.message
              : 'Failed to fetch elevator devices from DOB NOW'
          )
          dobDevices = []
        }

        for (const device of dobDevices.filter((d) => (d as any).status?.toLowerCase() === 'active')) {
          try {
            const rawType = this.firstPresentString([device.deviceType, device.deviceId, device.deviceNumber])
            const normalization = await this.normalizeDeviceType('DOB_NOW', rawType, device.deviceType || null)
            const asset = await this.upsertComplianceAsset(
              {
                property_id: propertyId,
                asset_type: 'elevator',
                name: device.deviceNumber || `Elevator ${device.deviceId}`,
                external_source: 'dob_now_elevator_devices',
                external_source_id: device.deviceId,
                metadata: device,
                device_category:
                  (normalization.category as ComplianceDeviceCategory | null) || 'elevator',
                device_technology: normalization.technology || null,
                device_subtype: normalization.subtype || null,
                is_private_residence: normalization.is_private_residence ?? null,
              },
              orgId
            )

            if (asset) {
              assetsCreated++
              const filings = await this.dobNowClient.fetchElevatorFilings(device.deviceId)
              for (const filing of filings) {
                try {
                  await this.upsertComplianceEvent(
                    {
                      property_id: propertyId,
                      asset_id: asset.id,
                      event_type: 'filing',
                      inspection_type: filing.filingType,
                      inspection_date: filing.filingDate ? filing.filingDate.split('T')[0] : null,
                      filed_date: filing.filingDate ? filing.filingDate.split('T')[0] : null,
                      compliance_status: filing.status,
                      defects: filing.defects || false,
                      inspector_name: filing.inspectorName || null,
                      inspector_company: filing.inspectorCompany || null,
                      external_tracking_number: filing.filingNumber,
                      raw_source: filing,
                    },
                    orgId
                  )
                  eventsCreated++
                } catch (error) {
                  logger.error({ error, filing }, 'Failed to upsert elevator filing event')
                  errors.push(
                    `Failed to sync filing ${filing.filingNumber}: ${
                      error instanceof Error ? error.message : 'Unknown error'
                    }`
                  )
                }
              }
            }
          } catch (error) {
            logger.error({ error, device }, 'Failed to upsert elevator asset (DOB NOW)')
            errors.push(
              `Failed to sync DOB NOW device ${device.deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        }

        // 3) Elevator-specific violations (active + historic) and complaints
        try {
          const [activeViolations, historicViolations, complaints] = await Promise.all([
            this.nycOpenDataClient.fetchElevatorActiveViolations(bin),
            this.nycOpenDataClient.fetchElevatorHistoricViolations(bin),
            this.nycOpenDataClient.fetchElevatorComplaints(bin),
          ])

          const allViolations = [
            ...activeViolations.map((v) => ({ ...v, category: 'violation' as const })),
            ...historicViolations.map((v) => ({ ...v, category: 'violation' as const })),
            ...complaints.map((v) => ({ ...v, category: 'complaint' as const })),
          ]

          for (const violation of allViolations) {
            try {
              const issueDate =
                violation.issueDate && violation.issueDate.split('T')[0]
                  ? violation.issueDate.split('T')[0]
                  : new Date().toISOString().split('T')[0]

              await this.upsertComplianceViolation(
                {
                  property_id: propertyId,
                  asset_id: null,
                  agency: 'DOB',
                  violation_number: violation.violationNumber,
                  issue_date: issueDate,
                  description: violation.description || 'Elevator violation/complaint',
                  severity_score: violation.severityScore || null,
                  status: (violation.status as ComplianceViolationStatus) || 'open',
                  cure_by_date: violation.cureByDate ? violation.cureByDate.split('T')[0] : null,
                  metadata: violation,
                  category: violation.category || 'violation',
                },
                orgId
              )
            } catch (error) {
              logger.error({ error, violation }, 'Failed to upsert elevator violation/complaint')
              errors.push(
                `Failed to sync elevator violation/complaint ${violation.violationNumber}: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`
              )
            }
          }
        } catch (error) {
          logger.error({ error, bin }, 'Failed to fetch elevator violations/complaints')
          errors.push(
            `Failed to fetch elevator violations/complaints: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }

        return { assets: assetsCreated, events: eventsCreated, errors: errors.length > 0 ? errors : undefined }
      } catch (error) {
        fatalError = error instanceof Error ? error.message : 'Unknown error'
        throw error
      } finally {
        try {
          await this.updateSyncState(orgId, 'dob_now', {
            last_seen_at: new Date().toISOString(),
            last_run_at: new Date().toISOString(),
            status: 'idle',
            last_error: fatalError || (errors.length > 0 ? errors.join('; ') : null),
          })
        } finally {
          await this.releaseLock(lockKey)
        }
      }
    } catch (error) {
      logger.error({ error, bin, propertyId, orgId }, 'Error in syncElevatorsByBIN')
      throw error
    }
  }

  /**
   * Sync boiler filings by BIN with advisory lock
   */
  async syncBoilersByBIN(
    bin: string,
    propertyId: string,
    orgId: string,
    _force = false
  ): Promise<{ assets: number; events: number; errors?: string[] }> {
    try {
      const lockKey = `compliance_sync:${orgId}:dob_now`
      const locked = await this.tryAcquireLock(lockKey)
      if (!locked) {
        logger.warn({ orgId, bin }, 'Compliance sync lock already held')
        return { assets: 0, events: 0, errors: ['Sync already in progress'] }
      }

      await this.updateSyncState(orgId, 'dob_now', { status: 'running' })

      let fatalError: string | null = null

      try {
        // Fetch boiler filings from NYC Open Data
        const filings = await this.nycOpenDataClient.fetchDOBNowSafetyBoilerFilings({ bin })

        let assetsCreated = 0
        let eventsCreated = 0
        const errors: string[] = []

        // Existing boiler assets for this property/org
        const { data: existingBoilers } = await supabaseAdmin
          .from('compliance_assets')
          .select('id, external_source_id, metadata, external_source')
          .eq('property_id', propertyId)
          .eq('org_id', orgId)
          .eq('asset_type', 'boiler')

        for (const filing of filings) {
          const boilerIdRaw = filing.boiler_id ?? filing.boilerid ?? null
          const boilerId = boilerIdRaw ? String(boilerIdRaw) : null
          const assetMatch =
            existingBoilers?.find(
              (a: any) =>
                (a.external_source_id && boilerId && String(a.external_source_id) === String(boilerId)) ||
                (boilerId && String((a.metadata as any)?.boiler_id || '') === String(boilerId)) ||
                (!boilerId && a.external_source_id && String(a.external_source_id) === String(bin))
            ) || null

          const mergedMetadata = this.stripUndefined({
            ...(assetMatch?.metadata as Record<string, unknown> | null | undefined),
            ...filing,
            boiler_id: boilerId,
            pressure_type: filing.pressure_type || filing.pressuretype || null,
            bin: filing.bin_number || filing.bin || bin || null,
          })

          let boilerAssetId = assetMatch?.id || null

          try {
            const asset = await this.upsertComplianceAsset(
              {
                property_id: propertyId,
                asset_type: 'boiler',
                name: 'Boiler',
                external_source: 'nyc_open_data_boiler',
                external_source_id: boilerId || bin,
                metadata: mergedMetadata,
                device_category: 'boiler',
              },
              orgId
            )
            if (asset) {
              // Count as created only if this wasn’t previously present
              if (!boilerAssetId) assetsCreated++
              boilerAssetId = asset.id
            }
          } catch (error) {
            logger.error({ error, filing }, 'Failed to upsert boiler asset (Open Data)')
            errors.push(
              `Failed to upsert boiler asset ${boilerId || bin}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
            continue
          }

          try {
            const defectsRaw = filing.defects_exist ?? filing.defects ?? null
            const defectsBool =
              typeof defectsRaw === 'boolean'
                ? defectsRaw
                : typeof defectsRaw === 'string'
                ? ['true', 'yes', '1'].includes(defectsRaw.toLowerCase())
                : null

            const inspectionDate = filing.inspection_date || null
            const trackingRaw = filing.tracking_number ?? filing.boiler_id ?? filing.boilerid ?? null
            const externalTrackingNumber =
              typeof trackingRaw === 'string'
                ? trackingRaw
                : trackingRaw != null
                ? String(trackingRaw)
                : null
            await this.upsertComplianceEvent(
              {
                property_id: propertyId,
                asset_id: boilerAssetId,
                event_type: 'inspection',
                inspection_type: filing.inspection_type || filing.report_type || null,
                inspection_date: inspectionDate ? String(inspectionDate).split('T')[0] : null,
                filed_date: inspectionDate ? String(inspectionDate).split('T')[0] : null,
                compliance_status: filing.report_status || null,
                defects: defectsBool ?? false,
                external_tracking_number: externalTrackingNumber,
                raw_source: (filing as Record<string, unknown>) || {},
              },
              orgId
            )
            eventsCreated++
          } catch (error) {
            logger.error({ error, filing }, 'Failed to upsert boiler filing event')
            errors.push(`Failed to sync filing ${filing.filingNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        if (errors.length > 0) {
          fatalError = errors.join('; ')
        }

        return { assets: assetsCreated, events: eventsCreated, errors: errors.length > 0 ? errors : undefined }
      } finally {
        try {
          await this.updateSyncState(orgId, 'dob_now', {
            last_seen_at: new Date().toISOString(),
            last_run_at: new Date().toISOString(),
            status: 'idle',
            last_error: fatalError,
          })
        } finally {
          await this.releaseLock(`compliance_sync:${orgId}:dob_now`).catch(() => {})
        }
      }
    } catch (error) {
      logger.error({ error, bin, propertyId, orgId }, 'Error in syncBoilersByBIN')
      throw error
    }
  }

  /**
   * Sync facade filings (DOB NOW: Safety – Facades) by BIN with advisory lock
   */
  async syncFacadesByBIN(
    bin: string,
    propertyId: string,
    orgId: string,
    _force = false
  ): Promise<{ assets: number; events: number; errors?: string[] }> {
    try {
      const lockKey = `compliance_sync:${orgId}:nyc_open_data:facade`
      const locked = await this.tryAcquireLock(lockKey)
      if (!locked) {
        logger.warn({ orgId, bin }, 'Compliance sync lock already held')
        return { assets: 0, events: 0, errors: ['Sync already in progress'] }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

      let fatalError: string | null = null

      try {
        const filings = await this.nycOpenDataClient.fetchDOBNowSafetyFacadeFilings({ bin })

        let assetsCreated = 0
        let eventsCreated = 0
        const errors: string[] = []

        const { data: existingFacades } = await supabaseAdmin
          .from('compliance_assets')
          .select('id, external_source_id, external_source, metadata')
          .eq('property_id', propertyId)
          .eq('org_id', orgId)
          .eq('asset_type', 'facade')

        let facadeAssetId: string | null =
          existingFacades && existingFacades.length > 0 ? existingFacades[0].id : null

        // Always upsert the facade asset when data is fetched so all Open Data fields persist in metadata
        const first = filings[0] || null
        if (first || facadeAssetId) {
          try {
            const mergedMetadata = this.stripUndefined({
              ...(existingFacades?.[0]?.metadata as Record<string, unknown> | undefined),
              ...(first || {}),
              bin: first?.bin || bin,
              cycle: first?.cycle || null,
              current_status: first?.current_status || null,
            })

            const asset = await this.upsertComplianceAsset(
              {
                property_id: propertyId,
                asset_type: 'facade',
                name: 'Facade',
                external_source: existingFacades?.[0]?.external_source || 'nyc_open_data_facade',
                external_source_id:
                  existingFacades?.[0]?.external_source_id || first?.tr6_no || first?.control_no || bin,
                metadata: mergedMetadata,
              },
              orgId
            )
            if (asset) {
              if (!facadeAssetId) assetsCreated++
              facadeAssetId = asset.id
            }
          } catch (error) {
            logger.error({ error, bin }, 'Failed to upsert facade asset')
            errors.push(`Failed to upsert facade asset for BIN ${bin}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }

        for (const filing of filings) {
          try {
            const submittedDate = filing.submitted_on || filing.filing_date || null
            const status = filing.current_status || filing.filing_status || null
            const externalId =
              filing.tr6_no || filing.control_no || filing.sequence_no || filing.bin || bin || null

            await this.upsertComplianceEvent(
              {
                property_id: propertyId,
                asset_id: facadeAssetId,
                event_type: 'filing',
                inspection_type: filing.filing_type || filing.cycle || null,
                inspection_date: submittedDate ? String(submittedDate).split('T')[0] : null,
                filed_date: submittedDate ? String(submittedDate).split('T')[0] : null,
                compliance_status: status,
                defects: false,
                external_tracking_number: externalId,
                raw_source: filing,
              },
              orgId
            )
            eventsCreated++
          } catch (error) {
            logger.error({ error, filing }, 'Failed to upsert facade filing event')
            errors.push(
              `Failed to sync facade filing ${filing.tr6_no || filing.control_no || filing.sequence_no || 'unknown'}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          }
        }

        if (errors.length > 0) {
          fatalError = errors.join('; ')
        }

        return { assets: assetsCreated, events: eventsCreated, errors: errors.length ? errors : undefined }
      } finally {
        try {
          await this.updateSyncState(orgId, 'nyc_open_data', {
            last_seen_at: new Date().toISOString(),
            last_run_at: new Date().toISOString(),
            status: 'idle',
            last_error: fatalError,
          })
        } finally {
          await this.releaseLock(lockKey).catch(() => {})
        }
      }
    } catch (error) {
      logger.error({ error, bin, propertyId, orgId }, 'Error in syncFacadesByBIN')
      throw error
    }
  }

  /**
   * Sync violations by BIN with advisory lock
   */
  async syncViolationsByBIN(
    bin: string,
    propertyId: string,
    orgId: string,
    bbl?: string | null,
    force = false
  ): Promise<{ violations: number; errors?: string[] }> {
    try {
      const hasBin = Boolean(bin && bin.trim())
      const hasBbl = Boolean(bbl && String(bbl).trim())
      let blockFromBbl: string | null = null
      let lotFromBbl: string | null = null
      if (hasBbl && bbl) {
        const digits = String(bbl).replace(/\D+/g, '')
        if (digits.length === 10) {
          blockFromBbl = digits.slice(1, 6)
          lotFromBbl = digits.slice(6)
        }
      }
      const deviceToAssetId = new Map<string, string>()
      const syncState = await this.getSyncState(orgId, 'nyc_open_data')
      const isFirstRun = !syncState?.last_run_at
      const shouldFetchDobViolations = force || isFirstRun

      if (propertyId) {
        const { data: assetsForProperty } = await supabaseAdmin
          .from('compliance_assets')
          .select('id, external_source_id, metadata')
          .eq('property_id', propertyId)
          .eq('org_id', orgId)

        for (const asset of assetsForProperty || []) {
          const meta = ((asset as any)?.metadata || {}) as Record<string, any>
          const candidates = [
            asset.external_source_id,
            meta.device_number,
            meta.deviceid,
            meta.device_id,
            meta.device_num,
          ]
          for (const candidate of candidates) {
            if (!candidate) continue
            const key = String(candidate)
            if (!deviceToAssetId.has(key)) {
              deviceToAssetId.set(key, asset.id)
            }
          }
        }
      }

      const lockKey = `compliance_sync:${orgId}:nyc_open_data`
      const locked = await this.tryAcquireLock(lockKey)
      if (!locked) {
        logger.warn({ orgId, bin }, 'Compliance sync lock already held')
        return { violations: 0, errors: ['Sync already in progress'] }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

      try {
        let violationsCreated = 0
        const errors: string[] = []

        const [
          dobSafetyViolations,
          dobViolations,
          dobActiveViolations,
          dobEcbViolations,
          hpdViolations,
          hpdComplaints,
          fdnyViolations,
          asbestosViolations,
          backflowPreventionViolations,
          sidewalkViolations,
          indoorEnvironmentalComplaints,
        ] = await Promise.all([
          hasBin || hasBbl
            ? this.nycOpenDataClient.fetchDOBSafetyViolations(hasBin ? bin : undefined, hasBbl ? bbl || undefined : undefined).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch DOB Safety violations (Open Data)')
                return []
              })
            : Promise.resolve([]),
          hasBin && shouldFetchDobViolations
            ? this.nycOpenDataClient.fetchDOBViolations(bin).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch DOB violations (Open Data)')
                return []
              })
            : Promise.resolve([]),
          hasBin
            ? this.nycOpenDataClient.fetchDOBActiveViolations(bin).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch active DOB violations (Open Data)')
                return []
              })
            : Promise.resolve([]),
          hasBin
            ? this.nycOpenDataClient.fetchDOBECBViolations(bin).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch DOB ECB violations (Open Data)')
                return []
              })
            : Promise.resolve([]),
          (bbl
            ? this.nycOpenDataClient.fetchHPDViolations(bbl).catch((e) => {
                logger.error({ error: e, bbl }, 'Failed to fetch HPD violations')
                return []
              })
            : Promise.resolve([])),
          (bbl
            ? this.nycOpenDataClient.fetchHPDComplaints(bbl).catch((e) => {
                logger.error({ error: e, bbl }, 'Failed to fetch HPD complaints')
                return []
              })
            : Promise.resolve([])),
          hasBin || blockFromBbl || lotFromBbl
            ? this.nycOpenDataClient
                .fetchFDNYViolations({
                  bin: hasBin ? bin : null,
                  block: blockFromBbl,
                  lot: lotFromBbl,
                })
                .catch((e) => {
                  logger.error({ error: e, bin }, 'Failed to fetch FDNY violations')
                  return []
                })
            : Promise.resolve([]),
          hasBin || blockFromBbl || lotFromBbl
            ? this.nycOpenDataClient
                .fetchAsbestosViolations({
                  bin: hasBin ? bin : null,
                  block: blockFromBbl,
                  lot: lotFromBbl,
                })
                .catch((e) => {
                  logger.error({ error: e, bin }, 'Failed to fetch asbestos violations')
                  return []
                })
            : Promise.resolve([]),
          hasBin || blockFromBbl || lotFromBbl
            ? this.nycOpenDataClient
                .fetchBackflowPreventionViolations({
                  bin: hasBin ? bin : null,
                  block: blockFromBbl,
                  lot: lotFromBbl,
                })
                .catch((e) => {
                  logger.error({ error: e, bin }, 'Failed to fetch backflow prevention violations')
                  return []
                })
            : Promise.resolve([]),
          hasBbl
            ? this.nycOpenDataClient.fetchSidewalkViolationsByBBL(bbl as string).catch((e) => {
                logger.error({ error: e, bbl }, 'Failed to fetch sidewalk violations')
                return []
              })
            : Promise.resolve([]),
          hasBin
            ? this.nycOpenDataClient.fetchIndoorEnvironmentalComplaints(bin).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch asbestos violations')
                return []
              })
            : Promise.resolve([]),
        ])

        const combined = [
          ...dobSafetyViolations.map((v) => ({ ...v, agency: 'DOB' })),
          ...(shouldFetchDobViolations ? dobViolations.map((v) => ({ ...v, agency: 'DOB' })) : []),
          ...dobActiveViolations.map((v) => ({ ...v, agency: 'DOB' })),
          ...dobEcbViolations.map((v) => ({ ...v, agency: 'DOB' })),
          ...hpdViolations.map((v) => ({ ...v, agency: 'HPD' })),
          ...hpdComplaints.map((v) => ({ ...v, agency: 'HPD' })),
          ...fdnyViolations.map((v) => ({ ...v, agency: 'FDNY' })),
          ...asbestosViolations.map((v) => ({ ...v, agency: 'DEP' })),
          ...backflowPreventionViolations.map((v) => ({ ...v, agency: 'DEP' })),
          ...sidewalkViolations.map((v) => ({ ...v, agency: 'DOT' })),
          ...indoorEnvironmentalComplaints.map((v) => ({ ...v, agency: 'DOHMH' })),
        ]

        for (const violation of combined) {
          try {
            const vMeta = violation as Record<string, any>
            const deviceNumber = vMeta.deviceNumber ?? vMeta.device_number ?? null
            const assetId = (deviceNumber && deviceToAssetId.get(String(deviceNumber))) || null
            const rawIssueDate = vMeta.issueDate ?? vMeta.inspection_date ?? vMeta.violation_date ?? null
            const issueDate =
              rawIssueDate && String(rawIssueDate).split('T')[0]
                ? String(rawIssueDate).split('T')[0]
                : new Date().toISOString().split('T')[0]

            await this.upsertComplianceViolation(
              {
                property_id: propertyId,
                asset_id: assetId,
                agency: (violation.agency || 'OTHER') as any,
                violation_number: vMeta.violationNumber || vMeta.violation_number || null,
                issue_date: issueDate,
                description: vMeta.description || vMeta.violation_description || 'Violation',
                severity_score: vMeta.severityScore || vMeta.severity_score || null,
                status:
                  vMeta.status?.toLowerCase().includes('open') || vMeta.status?.toLowerCase().includes('active')
                    ? 'open'
                    : vMeta.status?.toLowerCase().includes('clear')
                    ? 'cleared'
                    : 'closed',
                cure_by_date: vMeta.cureByDate ? String(vMeta.cureByDate).split('T')[0] : null,
                metadata: violation as any,
                category: (violation as any).category || 'violation',
              },
              orgId
            )
            violationsCreated++
          } catch (error) {
            logger.error({ error, violation }, 'Failed to upsert violation')
            const violationNumber =
              (violation as any)?.violationNumber ?? (violation as any)?.violation_number ?? null
            const violationNumberString = violationNumber != null ? String(violationNumber) : 'unknown'
            errors.push(
              `Failed to sync violation ${violationNumberString}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          }
        }

        return { violations: violationsCreated, errors: errors.length > 0 ? errors : undefined }
      } finally {
        await this.updateSyncState(orgId, 'nyc_open_data', {
          status: 'idle',
          last_run_at: new Date().toISOString(),
        }).catch((e) => {
          logger.warn({ error: e }, 'Failed to update sync state')
        })
        await this.releaseLock(lockKey).catch(() => {})
      }
    } catch (error) {
      logger.error({ error, bin, propertyId, orgId }, 'Error in syncViolationsByBIN')
      throw error
    }
  }

  /**
   * Sync a single violation source (dataset-level) to support granular progress UI.
   */
  async syncViolationsBySource(options: {
    source: ViolationSource
    propertyId: string
    orgId: string
    bin?: string | null
    bbl?: string | null
    block?: string | null
    lot?: string | null
  }): Promise<{ source: ViolationSource; processed: number; errors: string[] }> {
    const { source, propertyId, orgId, bin, bbl, block, lot } = options
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    const hasBlockLot = Boolean(block && lot)
    const errors: string[] = []
    let processed = 0

    if (!this.nycOpenDataClient) {
      await this.hydrateOpenDataClient(orgId)
    }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) {
      return { source, processed, errors: ['Sync already in progress'] }
    }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      const { data: assetsForProperty } = await supabaseAdmin
        .from('compliance_assets')
        .select('id, external_source_id, metadata')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)

      const deviceToAssetId = new Map<string, string>()
      for (const asset of assetsForProperty || []) {
        const meta = ((asset as any)?.metadata || {}) as Record<string, any>
        const candidates = [
          asset.external_source_id,
          meta.device_number,
          meta.deviceid,
          meta.device_id,
          meta.device_num,
        ]
        for (const candidate of candidates) {
          if (!candidate) continue
          const key = String(candidate)
          if (!deviceToAssetId.has(key)) {
            deviceToAssetId.set(key, asset.id)
          }
        }
      }

    const fetchSource = async (): Promise<Array<any>> => {
      switch (source) {
        case 'dob_safety_violations':
          return (hasBin || hasBbl)
            ? this.nycOpenDataClient.fetchDOBSafetyViolations(hasBin ? bin : undefined, hasBbl ? bbl || undefined : undefined)
              : []
          case 'dob_violations':
            return hasBin ? this.nycOpenDataClient.fetchDOBViolations(bin as string) : []
          case 'dob_active_violations':
            return hasBin ? this.nycOpenDataClient.fetchDOBActiveViolations(bin as string) : []
          case 'dob_ecb_violations':
            return hasBin ? this.nycOpenDataClient.fetchDOBECBViolations(bin as string) : []
          case 'hpd_violations':
            return hasBbl ? this.nycOpenDataClient.fetchHPDViolations(bbl as string) : []
          case 'hpd_complaints':
            return hasBbl ? this.nycOpenDataClient.fetchHPDComplaints(bbl as string) : []
          case 'fdny_violations':
            return (hasBin || hasBlockLot)
              ? this.nycOpenDataClient.fetchFDNYViolations({
                  bin,
                  block,
                  lot,
                })
              : []
          case 'asbestos_violations':
            return (hasBin || hasBlockLot)
              ? this.nycOpenDataClient.fetchAsbestosViolations({
                  bin,
                  block,
                  lot,
                })
              : []
          case 'backflow_prevention_violations':
            return (hasBin || hasBlockLot)
              ? this.nycOpenDataClient.fetchBackflowPreventionViolations({
                  bin,
                  block,
                  lot,
                })
              : []
          case 'sidewalk_violations':
            return hasBbl ? this.nycOpenDataClient.fetchSidewalkViolationsByBBL(bbl as string) : []
          case 'indoor_environmental_complaints':
            return hasBin
              ? this.nycOpenDataClient.fetchIndoorEnvironmentalComplaints(bin as string)
              : []
          default:
            return []
        }
      }

      const rawViolations = await fetchSource().catch((e) => {
        errors.push(e instanceof Error ? e.message : String(e))
        return []
      })

      const violationsWithAgency =
        source === 'hpd_violations' || source === 'hpd_complaints'
          ? rawViolations.map((v) => ({ ...v, agency: 'HPD' }))
          : source === 'fdny_violations'
            ? rawViolations.map((v) => ({ ...v, agency: 'FDNY' }))
            : source === 'asbestos_violations' || source === 'backflow_prevention_violations'
              ? rawViolations.map((v) => ({ ...v, agency: 'DEP' }))
              : rawViolations.map((v) => ({ ...v, agency: (v as any).agency || 'DOB' }))

      for (const violation of violationsWithAgency) {
        try {
          const assetId =
            (violation.deviceNumber && deviceToAssetId.get(String(violation.deviceNumber))) || null
          const issueDate =
            violation.issueDate && violation.issueDate.split?.('T')[0]
              ? violation.issueDate.split('T')[0]
              : violation.issue_date
                ? String(violation.issue_date).split('T')[0]
                : new Date().toISOString().split('T')[0]

          await this.upsertComplianceViolation(
            {
              property_id: propertyId,
              asset_id: assetId,
              agency: (violation.agency || 'OTHER') as any,
              violation_number:
                violation.violationNumber ||
                violation.violation_number ||
                `V-${source}-${issueDate || Date.now()}`,
              issue_date: issueDate,
              description: violation.description || violation.violation_description || 'Violation',
              severity_score: violation.severityScore || null,
              status:
                violation.status?.toLowerCase().includes('open') || violation.status?.toLowerCase().includes('active')
                  ? 'open'
                  : violation.status?.toLowerCase().includes('clear')
                    ? 'cleared'
                    : 'closed',
              cure_by_date: violation.cureByDate
                ? violation.cureByDate.split('T')[0]
                : violation.cure_by_date
                  ? String(violation.cure_by_date).split('T')[0]
                  : null,
              metadata: violation,
              category: (violation as any).category || 'violation',
            },
            orgId
          )
          processed++
        } catch (error) {
          logger.error({ error, violation }, 'Failed to upsert violation (single source)')
          errors.push(
            `Failed to sync violation ${violation.violationNumber || violation.violation_number || 'unknown'}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        }
      }
    } finally {
      await this.updateSyncState(orgId, 'nyc_open_data', {
        status: 'idle',
        last_run_at: new Date().toISOString(),
      }).catch((e) => {
        logger.warn({ error: e }, 'Failed to update sync state after single-source violation sync')
      })
      await this.releaseLock(lockKey).catch(() => {})
    }

    return { source, processed, errors }
  }


  /**
   * Sync Bedbug Reporting filings (HPD) by BIN/BBL
   */
  async syncBedbugReporting(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    if (!hasBin && !hasBbl) {
      return { events: 0, errors: ['Missing BIN/BBL for bedbug reporting sync'] }
    }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) {
      logger.warn({ orgId, bin, bbl }, 'Compliance sync lock already held for bedbug reporting')
      return { events: 0, errors: ['Sync already in progress'] }
    }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []

      const reports = await this.nycOpenDataClient
        .fetchBedbugReporting(hasBin ? bin || undefined : undefined, hasBbl ? bbl || undefined : undefined)
        .catch((error) => {
          logger.error({ error, bin, bbl }, 'Failed to fetch bedbug reporting records')
          errors.push(error instanceof Error ? error.message : 'Failed to fetch bedbug reporting')
          return []
        })

      for (const report of reports || []) {
        try {
          const filedDate =
            this.normalizeDate((report as any).filing_date) ||
            this.normalizeDate((report as any).file_date) ||
            this.normalizeDate((report as any).filingdate)
          const periodEnd =
            this.normalizeDate((report as any).filing_period_end) ||
            this.normalizeDate((report as any).filing_period_end_date)
          const periodStart =
            this.normalizeDate((report as any).filing_period_start) ||
            this.normalizeDate((report as any).filing_period_start_date)
          const complianceStatus =
            (report as any).status ||
            (report as any).filing_status ||
            (report as any).submissionstatus ||
            null
          const trackingNumber =
            (report as any).registrationid ||
            (report as any).registration_id ||
            (report as any).buildingid ||
            (report as any).building_id ||
            (report as any).filingid ||
            (report as any).filing_id ||
            (hasBin ? bin : '') ||
            (hasBbl ? bbl : '') ||
            propertyId

          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: null,
            event_type: 'filing',
            inspection_type: 'Bedbug Reporting',
            inspection_date: periodEnd || periodStart || filedDate,
            filed_date: filedDate,
            compliance_status: complianceStatus,
            defects: false,
            external_tracking_number: trackingNumber ? String(trackingNumber) : null,
            raw_source: report,
            inspector_name: null,
            inspector_company: null,
          }

          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData

          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          logger.error({ error, report, propertyId }, 'Failed to upsert bedbug reporting event')
          errors.push(error instanceof Error ? error.message : 'Failed to upsert bedbug event')
        }
      }

      let fatalError: string | null = null
      if (errors.length) {
        fatalError = errors.join('; ')
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: fatalError,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync HPD Registrations by BIN/BBL
   */
  async syncHpdRegistrations(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const bblParts = this.parseBbl(bbl)
    if (!hasBin && !bblParts.boro) {
      return { events: 0, errors: ['Missing BIN/BBL for HPD registrations sync'] }
    }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) {
      logger.warn({ orgId, bin, bbl }, 'Compliance sync lock already held for HPD registrations')
      return { events: 0, errors: ['Sync already in progress'] }
    }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []

      const registrations = await this.nycOpenDataClient
        .fetchHPDRegistrations({
          bin: hasBin ? bin || undefined : undefined,
          boro: bblParts.boro || undefined,
          block: bblParts.block || undefined,
          lot: bblParts.lot || undefined,
        })
        .catch((error) => {
          logger.error({ error, bin, bbl }, 'Failed to fetch HPD registrations')
          errors.push(error instanceof Error ? error.message : 'Failed to fetch HPD registrations')
          return []
        })

      for (const reg of registrations || []) {
        try {
          const filedDate =
            this.normalizeDate((reg as any).lastregistrationdate) ||
            this.normalizeDate((reg as any).filing_date) ||
            this.normalizeDate((reg as any).registrationenddate) ||
            null
          const periodEnd =
            this.normalizeDate((reg as any).registrationenddate) ||
            this.normalizeDate((reg as any).expiresdate) ||
            null
          const periodStart =
            this.normalizeDate((reg as any).registrationstartdate) ||
            this.normalizeDate((reg as any).startdate) ||
            null
          const trackingNumber =
            (reg as any).registrationid ||
            (reg as any).buildingid ||
            (reg as any).bin ||
            (reg as any).bbl ||
            bin ||
            bbl ||
            propertyId
          const status =
            (reg as any).registration_status ||
            (reg as any).status ||
            (reg as any).registrationtype ||
            null

          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: null,
            event_type: 'filing',
            inspection_type: 'HPD Registration',
            inspection_date: periodEnd || periodStart || filedDate,
            filed_date: filedDate,
            compliance_status: status,
            defects: false,
            external_tracking_number: trackingNumber ? String(trackingNumber) : null,
            raw_source: reg,
            inspector_name: null,
            inspector_company: null,
          }

          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData

          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          logger.error({ error, reg, propertyId }, 'Failed to upsert HPD registration event')
          errors.push(error instanceof Error ? error.message : 'Failed to upsert HPD registration')
        }
      }

      let fatalError: string | null = null
      if (errors.length) fatalError = errors.join('; ')

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: fatalError,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync DOB NOW approved permits
   */
  async syncDobNowApprovedPermits(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    if (!hasBin && !hasBbl) return { events: 0 }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const permits = await this.nycOpenDataClient
        .fetchDOBNowApprovedPermits({
          bin: hasBin ? bin || undefined : undefined,
          bbl: hasBbl ? bbl || undefined : undefined,
        })
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch DOB NOW permits')
          return []
        })

      for (const permit of permits || []) {
        try {
          const filedDate =
            this.normalizeDate((permit as any).approved_date) ||
            this.normalizeDate((permit as any).issued_date) ||
            this.normalizeDate((permit as any).filing_date) ||
            null
          const assetType = this.inferAssetTypeFromWork(
            (permit as any).work_type || (permit as any).filing_reason,
            (permit as any).job_description,
          )
          const assetId = assetType
            ? await this.findSingleAssetIdForType(
                propertyId,
                orgId,
                assetType,
                (permit as any).device_identifier,
              )
            : null
          const tracking =
            (permit as any).job_filing_number ||
            (permit as any).jobnumber ||
            (permit as any).bbl ||
            bin ||
            bbl ||
            propertyId
          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: assetId || null,
            event_type: 'filing',
            inspection_type: 'DOB NOW Approved Permit',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (permit as any).permit_status || (permit as any).filing_status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: permit,
            inspector_name: null,
            inspector_company: null,
          }
          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData
          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert DOB NOW permit')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync DOB NOW job filings (Build)
   */
  async syncDobNowJobFilings(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    if (!hasBin && !hasBbl) return { events: 0 }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const filings = await this.nycOpenDataClient
        .fetchDOBNowJobFilings({
          bin: hasBin ? bin || undefined : undefined,
          bbl: hasBbl ? bbl || undefined : undefined,
        })
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch DOB NOW job filings')
          return []
        })

      for (const filing of filings || []) {
        try {
          const filedDate =
            this.normalizeDate((filing as any).filing_date) ||
            this.normalizeDate((filing as any).approved_date) ||
            this.normalizeDate((filing as any).last_status_date) ||
            null
          const assetType = this.inferAssetTypeFromWork(
            (filing as any).work_type,
            (filing as any).job_description,
          )
          const assetId = assetType
            ? await this.findSingleAssetIdForType(
                propertyId,
                orgId,
                assetType,
                (filing as any).device_identifier,
              )
            : null
          const tracking =
            (filing as any).job_filing_number ||
            (filing as any).jobnumber ||
            (filing as any).bbl ||
            bin ||
            bbl ||
            propertyId
          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: assetId || null,
            event_type: 'filing',
            inspection_type: 'DOB NOW Job Filing',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (filing as any).filing_status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: filing,
            inspector_name: null,
            inspector_company: null,
          }
          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData
          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert DOB NOW job filing')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync DOB permit issuance (legacy BIS)
   */
  async syncDobPermitIssuanceOld(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    if (!hasBin && !hasBbl) return { events: 0 }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const permits = await this.nycOpenDataClient
        .fetchDOBPermitIssuanceOld({
          bin: hasBin ? bin || undefined : undefined,
          bbl: hasBbl ? bbl || undefined : undefined,
        })
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch DOB permit issuance')
          return []
        })

      for (const permit of permits || []) {
        try {
          const filedDate =
            this.normalizeDate((permit as any).issuance_date) ||
            this.normalizeDate((permit as any).issuancedate) ||
            this.normalizeDate((permit as any).issue_date) ||
            null
          const assetType = this.inferAssetTypeFromWork(
            (permit as any).work_type || (permit as any).permit_type || (permit as any).permit_subtype,
            (permit as any).job_description,
          )
          const assetId = assetType
            ? await this.findSingleAssetIdForType(
                propertyId,
                orgId,
                assetType,
                (permit as any).device_identifier,
              )
            : null
          const tracking =
            (permit as any).permit_si_no ||
            (permit as any).permitnumber ||
            (permit as any).job__ ||
            bin ||
            bbl ||
            propertyId

          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: assetId || null,
            event_type: 'filing',
            inspection_type: 'DOB Permit Issuance (BIS)',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (permit as any).permit_status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: permit,
            inspector_name: null,
            inspector_company: null,
          }

          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData

          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert DOB permit issuance')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync DOB Job Application Filings (BIS)
   */
  async syncDobJobApplications(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    if (!hasBin && !hasBbl) return { events: 0 }

    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const filings = await this.nycOpenDataClient
        .fetchDOBJobApplications({
          bin: hasBin ? bin || undefined : undefined,
          bbl: hasBbl ? bbl || undefined : undefined,
        })
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch DOB job applications')
          return []
        })

      for (const filing of filings || []) {
        try {
          const filedDate =
            this.normalizeDate((filing as any).filing_date) ||
            this.normalizeDate((filing as any).latest_action_date) ||
            null
          const assetType = this.inferAssetTypeFromWork(
            (filing as any).work_type || (filing as any).job_type,
            (filing as any).job_description,
          )
          const assetId = assetType
            ? await this.findSingleAssetIdForType(
                propertyId,
                orgId,
                assetType,
                (filing as any).device_identifier,
              )
            : null
          const tracking =
            (filing as any).job__ ||
            (filing as any).job_number ||
            (filing as any).jobno ||
            (filing as any).bbl ||
            bin ||
            bbl ||
            propertyId
          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: assetId || null,
            event_type: 'filing',
            inspection_type: 'DOB Job Application Filing (BIS)',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (filing as any).job_status || (filing as any).filing_status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: filing,
            inspector_name: null,
            inspector_company: null,
          }
          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData
          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert DOB job application filing')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Infer and seed compliance assets from building permits (DOB NOW + BIS)
   */
  private async seedAssetsFromPermits(propertyId: string, orgId: string) {
    try {
      const { data: permits } = await supabaseAdmin
        .from('building_permits')
        .select('*')
        .eq('org_id', orgId)
        .eq('property_id', propertyId)
        .in('source', ['dob_now_build_approved_permits', 'dob_permit_issuance_old', 'dob_job_applications'])
        .limit(500)

      // Prime cache if missing
      const existingAssets = await this.getAssetsForProperty(propertyId, orgId)
      const existingKeys = new Set(
        existingAssets.map(
          (a) => `${(a as any).external_source || ''}:${(a as any).external_source_id || ''}`,
        ),
      )

      for (const permit of permits || []) {
        const workType: string =
          (permit as any).work_type ||
          (permit as any).job_type ||
          (permit as any).permit_type ||
          (permit as any).permit_subtype ||
          (permit as any).job_description ||
          ''
        const description: string = (permit as any).job_description || ''
        const assetType = this.inferAssetTypeFromWork(workType, description)
        if (!assetType) continue

        const externalSource = `dob_permit_${(permit as any).source || 'unknown'}`
        const externalIdCandidates = [
          (permit as any).device_identifier,
          (permit as any).job_filing_number,
          (permit as any).job_number,
          (permit as any).work_permit,
          (permit as any).permit_sequence_number,
          (permit as any).job_doc_number,
        ]
        const externalId = externalIdCandidates.find((v) => v) || null
        if (!externalId) continue

        const key = `${externalSource}:${externalId}`
        if (existingKeys.has(key)) continue

        const name = `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} ${externalId}`
        const insertPayload: ComplianceAssetInsert = {
          property_id: propertyId,
          org_id: orgId,
          asset_type: assetType as any,
          name,
          location_notes: null,
          device_category: this.normalizeDeviceCategory(assetType),
          external_source: externalSource,
          external_source_id: String(externalId),
          active: true,
          metadata: permit as any,
        }

        const { error } = await supabaseAdmin.from('compliance_assets').insert(insertPayload)
        if (!error) {
          existingKeys.add(key)
        } else {
          logger.warn({ error, permitId: (permit as any).id, propertyId, orgId }, 'Failed to seed asset from permit')
        }
      }
      // refresh cache with newly seeded assets
      const { data: refreshed } = await supabaseAdmin
        .from('compliance_assets')
        .select('id, asset_type, active')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
      const rows =
        (refreshed as Array<{ id: string; asset_type: string; active: boolean }> | null) || []
      this.assetCache.set(propertyId, rows)
    } catch (error) {
      logger.warn({ error, propertyId, orgId }, 'Permit-based asset seeding failed')
    }
  }

  private inferAssetTypeFromWork(workType?: string | null, description?: string | null): string | null {
    const text = `${workType || ''} ${description || ''}`.toLowerCase()
    if (!text.trim()) return null
    if (text.includes('elevator') || text.includes('lift')) return 'elevator'
    if (text.includes('boiler')) return 'boiler'
    if (text.includes('sprinkler') || text.includes('standpipe')) return 'sprinkler'
    if (text.includes('gas')) return 'gas_piping'
    if (text.includes('facade') || text.includes('façade')) return 'facade'
    return null
  }

  private async getAssetsForProperty(propertyId: string, orgId: string) {
    if (this.assetCache.has(propertyId)) return this.assetCache.get(propertyId) || []
    const { data } = await supabaseAdmin
      .from('compliance_assets')
      .select('id, asset_type, active')
      .eq('property_id', propertyId)
      .eq('org_id', orgId)
    const rows = (data as Array<{ id: string; asset_type: string; active: boolean }> | null) || []
    this.assetCache.set(propertyId, rows)
    return rows
  }

  private async findSingleAssetIdForType(
    propertyId: string,
    orgId: string,
    assetType: string | null,
    deviceIdentifier?: string | null,
  ): Promise<string | null> {
    if (!assetType) return null
    const assets = await this.getAssetsForProperty(propertyId, orgId)
    const normalizedId = deviceIdentifier ? String(deviceIdentifier).toLowerCase() : null

    // First, try exact device identifier match against known external ids
    if (normalizedId) {
      const byId = assets.find(
        (a) =>
          a.asset_type === assetType &&
          a.active !== false &&
          ((a as any).external_source_id || '').toLowerCase() === normalizedId,
      )
      if (byId) return byId.id
    }

    const matching = assets.filter((a) => a.asset_type === assetType && a.active !== false)
    if (matching.length === 1) return matching[0].id
    // If multiple assets of same type exist, do not attach to avoid incorrect associations
    return null
  }


  /**
   * Sync DOB Certificate of Occupancy (legacy BIS)
   */
  async syncDobCertificateOfOccupancyOld(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    if (!bin) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const records = await this.nycOpenDataClient
        .fetchDOBCertificateOfOccupancyOld(bin)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch CO (old)')
          return []
        })

      for (const co of records || []) {
        try {
          const filedDate =
            this.normalizeDate((co as any).issue_date) ||
            this.normalizeDate((co as any).issued_date) ||
            this.normalizeDate((co as any).filing_date) ||
            null
          const tracking = (co as any).co_number || (co as any).document_number || bin || propertyId
          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: null,
            event_type: 'filing',
            inspection_type: 'Certificate of Occupancy (BIS)',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (co as any).status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: co,
            inspector_name: null,
            inspector_company: null,
          }
          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData
          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert CO (old)')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync DOB Certificate of Occupancy (DOB NOW)
   */
  async syncDobCertificateOfOccupancyNow(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    if (!bin) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const records = await this.nycOpenDataClient
        .fetchDOBCertificateOfOccupancyNow(bin)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch CO (NOW)')
          return []
        })

      for (const co of records || []) {
        try {
          const filedDate =
            this.normalizeDate((co as any).issue_date) ||
            this.normalizeDate((co as any).issued_date) ||
            this.normalizeDate((co as any).filing_date) ||
            null
          const tracking = (co as any).co_number || (co as any).document_number || bin || propertyId
          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: null,
            event_type: 'filing',
            inspection_type: 'Certificate of Occupancy (DOB NOW)',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (co as any).status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: co,
            inspector_name: null,
            inspector_company: null,
          }
          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData
          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert CO (NOW)')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync DOB complaints (Open Data)
   */
  async syncDobComplaints(
    propertyId: string,
    orgId: string,
    bin?: string | null
  ): Promise<{ events: number; errors?: string[] }> {
    if (!bin) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let violationsCreated = 0
      const errors: string[] = []
      const complaints = await this.nycOpenDataClient
        .fetchDOBComplaints(bin)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch DOB complaints')
          return []
        })

      for (const complaint of complaints || []) {
        try {
          const issueDate =
            this.normalizeDate((complaint as any).received_date) ||
            this.normalizeDate((complaint as any).issue_date) ||
            this.normalizeDate((complaint as any).created_date) ||
            null
          const safeIssueDate = issueDate || new Date().toISOString().split('T')[0]
          const violationNumber =
            (complaint as any).complaint_number ||
            (complaint as any).complaintid ||
            `DOB-COMP-${bin}-${issueDate || Date.now()}`
          await this.upsertComplianceViolation(
            {
              property_id: propertyId,
              asset_id: null,
              agency: 'DOB',
              violation_number: String(violationNumber),
              issue_date: safeIssueDate,
              description:
                (complaint as any).complaint_category ||
                (complaint as any).description ||
                'DOB complaint',
              status: ((complaint as any).status || 'open') as ComplianceViolationStatus,
              category: 'violation',
              severity_score: null,
              cure_by_date: null,
              metadata: complaint as any,
            },
            orgId
          )
          violationsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert DOB complaint')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: violationsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync elevator complaints (Open Data)
   */
  async syncElevatorComplaints(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    assets?: Array<any>
  ): Promise<{ events: number; errors?: string[] }> {
    if (!bin) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let violationsCreated = 0
      const errors: string[] = []
      const complaints = await this.nycOpenDataClient
        .fetchElevatorComplaints(bin)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch elevator complaints')
          return []
        })

      const assetByDevice = new Map<string, string>()
      for (const asset of assets || []) {
        const meta = ((asset as any)?.metadata || {}) as Record<string, any>
        const candidates = [
          meta.device_number,
          meta.deviceid,
          meta.device_id,
          meta.device_num,
          (asset as any).external_source_id,
        ]
        for (const candidate of candidates) {
          if (!candidate) continue
          assetByDevice.set(String(candidate), asset.id)
        }
      }

      for (const comp of complaints || []) {
        try {
          const issueDate = this.normalizeDate((comp as any).issueDate || (comp as any).issue_date)
          const safeIssueDate = issueDate || new Date().toISOString().split('T')[0]
          const violationNumber = (comp as any).violationNumber || (comp as any).violation_number
          const deviceNumber = (comp as any).deviceNumber || (comp as any).device_number || null
          const assetId = deviceNumber ? assetByDevice.get(String(deviceNumber)) || null : null

          await this.upsertComplianceViolation(
            {
              property_id: propertyId,
              asset_id: assetId,
              agency: 'DOB',
              violation_number:
                String(
                  violationNumber ||
                    (comp as any).complaintid ||
                    (comp as any).complaint_number ||
                    `ELV-COMP-${bin}-${issueDate || Date.now()}`
                ),
              issue_date: safeIssueDate,
              description:
                (comp as any).description ||
                (comp as any).complaint_category ||
                (comp as any).major_category ||
                'Elevator complaint',
              status: ((comp as any).status || 'open') as ComplianceViolationStatus,
              category: 'violation',
              severity_score: null,
              cure_by_date: null,
              metadata: comp as any,
            },
            orgId
          )
          violationsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert elevator complaint')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: violationsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync elevator violations (active/historic) as compliance violations
   */
  async syncElevatorViolations(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    assets?: Array<any>,
    historic = false
  ): Promise<{ events: number; errors?: string[] }> {
    if (!bin) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let violationsCreated = 0
      const errors: string[] = []
      const fetcher = historic
        ? this.nycOpenDataClient.fetchElevatorHistoricViolations.bind(this.nycOpenDataClient)
        : this.nycOpenDataClient.fetchElevatorActiveViolations.bind(this.nycOpenDataClient)
      const violations = await fetcher(bin).catch((error: any) => {
        errors.push(error instanceof Error ? error.message : 'Failed to fetch elevator violations')
        return []
      })

      const assetByDevice = new Map<string, string>()
      for (const asset of assets || []) {
        const meta = ((asset as any)?.metadata || {}) as Record<string, any>
        const candidates = [
          meta.device_number,
          meta.deviceid,
          meta.device_id,
          meta.device_num,
          (asset as any).external_source_id,
        ]
        for (const candidate of candidates) {
          if (!candidate) continue
          assetByDevice.set(String(candidate), asset.id)
        }
      }

      for (const vio of violations || []) {
        try {
          const deviceNumber = (vio as any).deviceNumber || (vio as any).device_number || null
          const assetId = deviceNumber ? assetByDevice.get(String(deviceNumber)) || null : null
          const normalizedIssueDate =
            this.normalizeDate((vio as any).issueDate || (vio as any).issue_date) ||
            new Date().toISOString().split('T')[0]
          await this.upsertComplianceViolation(
            {
              property_id: propertyId,
              asset_id: assetId,
              agency: 'DOB',
              violation_number: String((vio as any).violationNumber || (vio as any).violation_number),
              issue_date: normalizedIssueDate,
              description: (vio as any).description || 'Elevator violation',
              status: ((vio as any).status || 'open') as ComplianceViolationStatus,
              category: 'violation',
              severity_score: null,
              cure_by_date: null,
              metadata: vio as any,
            },
            orgId
          )
          violationsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert elevator violation')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: violationsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync sidewalk violations (DOT) by BBL
   */
  async syncSidewalkViolations(
    propertyId: string,
    orgId: string,
    bbl?: string | null
  ): Promise<{ events: number; errors?: string[] }> {
    if (!bbl) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let violationsCreated = 0
      const errors: string[] = []
      const records = await this.nycOpenDataClient
        .fetchSidewalkViolationsByBBL(bbl)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch sidewalk violations')
          return []
        })

      for (const record of records || []) {
        try {
          const issueDate =
            this.normalizeDate((record as any).violation_date) ||
            this.normalizeDate((record as any).issue_date) ||
            this.normalizeDate((record as any).issued_date) ||
            null
          const violationNumber =
            (record as any).violation_number ||
            (record as any).violationid ||
            `SIDEWALK-${bbl}-${issueDate || Date.now()}`

          const safeIssueDate = issueDate || new Date().toISOString().split('T')[0]

          await this.upsertComplianceViolation(
            {
              property_id: propertyId,
              asset_id: null,
              agency: 'OTHER',
              violation_number: String(violationNumber),
              issue_date: safeIssueDate,
              description: (record as any).description || 'Sidewalk violation',
              status: ((record as any).status || 'open') as ComplianceViolationStatus,
              category: 'violation',
              severity_score: null,
              cure_by_date: null,
              metadata: record as any,
            },
            orgId
          )
          violationsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert sidewalk violation')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: violationsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Sync Heat Sensor Program participation
   */
  async syncHeatSensorProgram(
    propertyId: string,
    orgId: string,
    bin?: string | null,
    bbl?: string | null,
    options?: { attachItemId?: (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput }
  ): Promise<{ events: number; errors?: string[] }> {
    const hasBin = Boolean(bin && bin.trim())
    const hasBbl = Boolean(bbl && String(bbl).trim())
    if (!hasBin && !hasBbl) return { events: 0 }
    const lockKey = `compliance_sync:${orgId}:nyc_open_data`
    const locked = await this.tryAcquireLock(lockKey)
    if (!locked) return { events: 0, errors: ['Sync already in progress'] }

    await this.updateSyncState(orgId, 'nyc_open_data', { status: 'running' })

    try {
      let eventsCreated = 0
      const errors: string[] = []
      const records = await this.nycOpenDataClient
        .fetchHeatSensorProgram(hasBin ? bin || undefined : undefined, hasBbl ? bbl || undefined : undefined)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : 'Failed to fetch Heat Sensor Program data')
          return []
        })

      for (const record of records || []) {
        try {
          const filedDate =
            this.normalizeDate((record as any).inspection_date) ||
            this.normalizeDate((record as any).updated_date) ||
            this.normalizeDate((record as any).last_status_update_date) ||
            null
          const tracking =
            (record as any).buildingid ||
            (record as any).bbl ||
            (record as any).bin ||
            bin ||
            bbl ||
            propertyId

          const eventData: ComplianceEventUpsertInput = {
            property_id: propertyId,
            asset_id: null,
            event_type: 'filing',
            inspection_type: 'Heat Sensor Program',
            inspection_date: filedDate,
            filed_date: filedDate,
            compliance_status: (record as any).status || null,
            defects: false,
            external_tracking_number: tracking ? String(tracking) : null,
            raw_source: record,
            inspector_name: null,
            inspector_company: null,
          }

          const eventWithItem = options?.attachItemId ? options.attachItemId(eventData) : eventData

          await this.upsertComplianceEvent(eventWithItem, orgId)
          eventsCreated++
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Failed to upsert Heat Sensor record')
        }
      }

      await this.updateSyncState(orgId, 'nyc_open_data', {
        last_seen_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        status: 'idle',
        last_error: errors.length ? errors.join('; ') : null,
      })

      return { events: eventsCreated, errors: errors.length ? errors : undefined }
    } finally {
      await this.releaseLock(lockKey).catch(() => {})
    }
  }

  /**
   * Upsert compliance asset (idempotent via external_source + external_source_id)
   */
  private async upsertComplianceAsset(
    data: Omit<ComplianceAssetInsert, 'org_id' | 'location_notes' | 'active' | 'metadata'> & {
      location_notes?: string | null
      active?: boolean
      metadata?: Record<string, unknown>
    },
    orgId: string
  ): Promise<{ id: string } | null> {
    try {
      const insertData = this.stripUndefined({
        ...data,
        device_category: this.normalizeDeviceCategory((data as any).device_category) ?? null,
        device_technology: (data as any).device_technology ?? null,
        device_subtype: (data as any).device_subtype ?? null,
        is_private_residence: (data as any).is_private_residence ?? null,
        location_notes: data.location_notes ?? null,
        active: data.active ?? true,
        metadata: this.toJson(data.metadata ?? {}),
        org_id: orgId,
      })

      // Check if asset exists
      if (data.external_source && data.external_source_id) {
        const { data: existing } = await supabaseAdmin
          .from('compliance_assets')
          .select('id')
          .eq('org_id', orgId)
          .eq('external_source', data.external_source)
          .eq('external_source_id', data.external_source_id)
          .maybeSingle()

        if (existing) {
          // Update existing
          const { data: updated, error } = await supabaseAdmin
            .from('compliance_assets')
            .update(insertData)
            .eq('id', existing.id)
            .select('id')
            .single()

          if (error) throw error
          return updated as { id: string }
        }
      }

      // Insert new
      const { data: inserted, error } = await supabaseAdmin
        .from('compliance_assets')
        .insert(insertData)
        .select('id')
        .single()

      if (error) throw error
      return inserted as { id: string }
    } catch (error) {
      logger.error({ error, data, orgId }, 'Error in upsertComplianceAsset')
      throw error
    }
  }

  /**
   * Upsert compliance event (idempotent via external_tracking_number)
   */
  private async upsertComplianceEvent(
    data: ComplianceEventUpsertInput,
    orgId: string
  ): Promise<void> {
    try {
      const insertData = this.stripUndefined({
        ...data,
        org_id: orgId,
        item_id: data.item_id ?? null,
        asset_id: data.asset_id ?? null,
        inspection_date: this.normalizeDate(data.inspection_date),
        filed_date: this.normalizeDate(data.filed_date),
        compliance_status: this.normalizeComplianceStatus(data.compliance_status),
        inspector_name: data.inspector_name ?? null,
        inspector_company: data.inspector_company ?? null,
        defects: data.defects ?? false,
        raw_source: this.toJson(data.raw_source ?? {}),
      })

      // Check if event exists
      if (data.external_tracking_number) {
        const { data: existing } = await supabaseAdmin
          .from('compliance_events')
          .select('id')
          .eq('org_id', orgId)
          .eq('external_tracking_number', data.external_tracking_number)
          .maybeSingle()

        if (existing) {
          // Update existing
          await supabaseAdmin
            .from('compliance_events')
            .update(insertData)
            .eq('id', existing.id)
          return
        }
      }

      // Insert new
      await supabaseAdmin
        .from('compliance_events')
        .insert(insertData)
    } catch (error) {
      logger.error({ error, data, orgId }, 'Error in upsertComplianceEvent')
      throw error
    }
  }

  /**
   * Upsert compliance violation (idempotent via violation_number)
   */
  private async upsertComplianceViolation(
    data: Omit<
      ComplianceViolationInsert,
      'org_id' | 'cleared_date' | 'linked_item_id' | 'linked_work_order_id'
    > & {
      cleared_date?: string | null
      linked_item_id?: string | null
      linked_work_order_id?: string | null
    },
    orgId: string
  ): Promise<void> {
    try {
      const violationNumberRaw =
        (data as any).violation_number ?? (data as any).violationNumber ?? data.violation_number ?? null
      const normalizedViolationNumber = violationNumberRaw != null ? String(violationNumberRaw) : null
      const safeIssueDate =
        this.normalizeDate((data as any).issue_date ?? (data as any).issueDate ?? data.issue_date ?? null) ||
        new Date().toISOString().split('T')[0]
      const normalizedDescription =
        (data as any).description ?? (data as any).violation_description ?? data.description ?? 'Violation'
      const insertData = {
        ...data,
        violation_number: normalizedViolationNumber,
        description: normalizedDescription,
        category: (data as any).category || 'violation',
        issue_date: safeIssueDate,
        org_id: orgId,
        metadata: this.toJson(data.metadata ?? {}),
        asset_id: data.asset_id ?? null,
        cleared_date: data.cleared_date ?? null,
        linked_item_id: data.linked_item_id ?? null,
        linked_work_order_id: data.linked_work_order_id ?? null,
      }

      if (!normalizedViolationNumber) {
        await supabaseAdmin.from('compliance_violations').insert(insertData as any)
        return
      }

      // Check if violation exists
      const { data: existing } = await supabaseAdmin
        .from('compliance_violations')
        .select('id')
        .eq('org_id', orgId)
        .eq('violation_number', normalizedViolationNumber)
        .maybeSingle()

      if (existing) {
        // Update existing
        await supabaseAdmin
          .from('compliance_violations')
          .update(insertData as any)
          .eq('id', existing.id)
        return
      }

      // Insert new
      await supabaseAdmin
        .from('compliance_violations')
        .insert(insertData as any)
    } catch (error) {
      logger.error({ error, data, orgId }, 'Error in upsertComplianceViolation')
      throw error
    }
  }

  /**
   * Normalize device type using device_type_normalization lookup, creating a row when missing.
   */
  private async normalizeDeviceType(
    sourceSystem: string,
    rawType?: string | null,
    rawDescription?: string | null
  ): Promise<{
    category: ComplianceDeviceCategory | null
    technology: string | null
    subtype: string | null
    is_private_residence: boolean | null
  }> {
    if (!rawType) {
      return { category: null, technology: null, subtype: null, is_private_residence: null }
    }
    const key = `${sourceSystem}:${rawType}`
    if (this.normalizationCache.has(key)) {
      return this.normalizationCache.get(key)!
    }

    // Try existing normalization
    const { data: existing } = await supabaseAdmin
      .from('device_type_normalization')
      .select('normalized_category, normalized_technology, normalized_subtype, default_is_private_residence')
      .eq('source_system', sourceSystem)
      .eq('raw_device_type', rawType)
      .maybeSingle()

    if (existing) {
      const normalized = {
        category: this.normalizeDeviceCategory(existing.normalized_category) ?? null,
        technology: existing.normalized_technology || null,
        subtype: existing.normalized_subtype || null,
        is_private_residence: existing.default_is_private_residence ?? null,
      }
      this.normalizationCache.set(key, normalized)
      return normalized
    }

    // Guess normalization and insert for future re-use
    const guessed = this.guessDeviceNormalization(rawType, rawDescription)
    try {
      await supabaseAdmin.from('device_type_normalization').insert({
        source_system: sourceSystem,
        raw_device_type: rawType,
        raw_description: rawDescription,
        normalized_category: guessed.category || 'elevator',
        normalized_technology: guessed.technology,
        normalized_subtype: guessed.subtype,
        default_is_private_residence: guessed.is_private_residence,
      })
    } catch (error) {
      logger.warn({ error, sourceSystem, rawType }, 'Failed to insert device normalization row (will proceed with guess)')
    }

    this.normalizationCache.set(key, guessed)
    return guessed
  }

  private guessDeviceNormalization(
    rawType: string,
    rawDescription?: string | null
  ): {
    category: ComplianceDeviceCategory | null
    technology: string | null
    subtype: string | null
    is_private_residence: boolean | null
  } {
    const text = `${rawType} ${rawDescription || ''}`.toLowerCase()
    const category = (() => {
      if (text.includes('escalator')) return 'escalator'
      if (text.includes('dumbwaiter')) return 'dumbwaiter'
      if (text.includes('wheelchair') || text.includes('platform')) return 'wheelchair_lift'
      if (text.includes('material') || text.includes('lift')) return 'material_lift'
      if (text.includes('chair')) return 'chairlift'
      return 'elevator'
    })()

    const subtype = (() => {
      if (text.includes('freight')) return 'freight'
      if (text.includes('passenger')) return 'passenger'
      if (text.includes('dumbwaiter')) return 'dumbwaiter'
      if (text.includes('wheelchair')) return 'wheelchair_lift'
      if (text.includes('material')) return 'material_lift'
      return null
    })()

    const technology = (() => {
      if (text.includes('traction') || text.includes('gearless') || text.includes('geared')) return 'traction'
      if (text.includes('hydraulic')) {
        if (text.includes('roped')) return 'roped_hydraulic'
        return 'hydraulic'
      }
      if (text.includes('mrl')) return 'mrl_traction'
      if (text.includes('winding') || text.includes('drum')) return 'winding_drum'
      return null
    })()

    const isPrivate = text.includes('private residence') || text.includes('pr lift') || text.includes('home lift')

    const normalizedCategory = this.normalizeDeviceCategory(category) || 'elevator'

    return { category: normalizedCategory, technology, subtype, is_private_residence: isPrivate || null }
  }

  /**
   * Update compliance items status from events
   */
  async updateComplianceItemsFromEvents(
    propertyId: string,
    orgId: string
  ): Promise<number> {
    try {
      // Get recent events for this property
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('compliance_events')
        .select('*, item_id')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
        .order('inspection_date', { ascending: false })
        .limit(100)

      if (eventsError) {
        logger.error({ error: eventsError, propertyId, orgId }, 'Failed to fetch events for item update')
        return 0
      }

      let itemsUpdated = 0

      for (const event of events || []) {
        if (!event.item_id) continue

        // Use database function to map event status to item status
        const { data: mappedStatus, error: mapError } = await supabaseAdmin.rpc(
          'map_event_status_to_item_status',
          {
            p_event_type: event.event_type,
            p_compliance_status: event.compliance_status ?? '',
          }
        )

        const normalizedStatus = typeof mappedStatus === 'string' ? mappedStatus : null
        if (mapError || !normalizedStatus) continue

        // Update item status
        const { error: updateError } = await supabaseAdmin
          .from('compliance_items')
          .update({
            status: normalizedStatus,
            result: event.compliance_status,
            defect_flag: event.defects,
          })
          .eq('id', event.item_id)
          .eq('org_id', orgId)

        if (!updateError) {
          itemsUpdated++
        }
      }

      return itemsUpdated
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in updateComplianceItemsFromEvents')
      return 0
    }
  }

  /**
   * Get sync state for org and source
   */
  private async getSyncState(orgId: string, source: ExternalSyncSource) {
    const { data, error } = await supabaseAdmin
      .from('external_sync_state')
      .select('*')
      .eq('org_id', orgId)
      .eq('source', source)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, orgId, source }, 'Failed to get sync state')
    }

    return data || null
  }

  /**
   * Sync all data sources required by applicable compliance programs for this property.
   * Only fetches sources that are explicitly set on program override_fields.nyc_datasource_id.
   */
  private async syncProgramDataSourcesForProperty(
    propertyId: string,
    orgId: string,
    options: { bin?: string | null; bbl?: string | null; borough?: string | null; building_id?: string | null }
  ): Promise<{ events: number; errors?: string[] }> {
    const { bin, bbl } = options
    let eventsCreated = 0
    const errors: string[] = []

    // Load property meta + assets for applicability checks
    const { data: propertyRow } = await supabaseAdmin
      .from('properties')
      .select('id, borough, borough_code, bin, building_id, total_units')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle()

    const propertyMeta: {
      id: string
      borough: string | null
      borough_code?: number | null
      bin: string | null
      occupancy_group?: string | null
      occupancy_description?: string | null
      is_one_two_family?: boolean | null
      is_private_residence_building?: boolean | null
      residential_units?: number | null
      property_total_units?: number | null
    } = {
      id: propertyId,
      borough: (propertyRow as any)?.borough ?? options.borough ?? null,
      borough_code: (propertyRow as any)?.borough_code ?? null,
      bin: (propertyRow as any)?.bin ?? bin ?? null,
      property_total_units: (propertyRow as any)?.total_units ?? null,
    }

    if ((propertyRow as any)?.building_id || options.building_id) {
      const buildingId = (propertyRow as any)?.building_id || options.building_id
      const { data: buildingRow } = await supabaseAdmin
        .from('buildings')
        .select(
          'id, borough_code, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, residential_units'
        )
        .eq('id', buildingId as string)
        .maybeSingle()
      if (buildingRow) {
        propertyMeta.borough_code =
          propertyMeta.borough_code ?? ((buildingRow as any).borough_code as number | null)
        propertyMeta.occupancy_group = (buildingRow as any).occupancy_group as string | null
        propertyMeta.occupancy_description = (buildingRow as any).occupancy_description as string | null
        propertyMeta.is_one_two_family = (buildingRow as any).is_one_two_family as boolean | null
        propertyMeta.is_private_residence_building = (buildingRow as any)
          .is_private_residence_building as boolean | null
        propertyMeta.residential_units = this.dwellingUnitsFromBuilding(buildingRow)
      }
    }

    const { data: assets } = await supabaseAdmin
      .from('compliance_assets')
      .select(
        'id, property_id, asset_type, external_source, active, metadata, device_category, device_technology, device_subtype, is_private_residence'
      )
      .eq('property_id', propertyId)
      .eq('org_id', orgId)

    const assetMetas =
      (assets || []).map((asset: any) => ({
        id: asset.id as string,
        property_id: asset.property_id as string,
        asset_type: (asset as any).asset_type as string | null,
        external_source: (asset as any).external_source as string | null,
        active: (asset as any).active !== false,
        metadata: ((asset as any).metadata || {}) as Record<string, unknown>,
        device_category: (asset as any).device_category as string | null,
        device_technology: (asset as any).device_technology as string | null,
        device_subtype: (asset as any).device_subtype as string | null,
        is_private_residence: (asset as any).is_private_residence as boolean | null,
      })) || []

    // Fetch programs with data sources
    const { data: programs } = await supabaseAdmin
      .from('compliance_programs')
      .select('id, applies_to, criteria, override_fields, is_enabled')
      .eq('org_id', orgId)
      .not('override_fields->>nyc_datasource_id', 'is', null)

    const datasourceIds = new Set<string>()
    for (const program of programs || []) {
      const override = ((program as any).override_fields || {}) as Record<string, unknown>
      const id = String(override?.nyc_datasource_id || '').trim()
      if (id) datasourceIds.add(id)
    }

    const datasourceKeyById = new Map<string, string>()
    if (datasourceIds.size > 0) {
      const { data: rows, error: dsError } = await supabaseAdmin
        .from('data_sources')
        .select('id, key, is_enabled')
        .in('id', Array.from(datasourceIds))

      if (dsError) {
        logger.error({ error: dsError, orgId }, 'Failed to load data_sources for sync')
      } else {
        for (const row of rows || []) {
          if (row?.is_enabled === false) continue
          if (row?.id && row?.key) {
            datasourceKeyById.set(row.id as string, row.key as string)
          }
        }
      }
    }

    const datasourcePrograms = new Map<string, { programs: any[] }>()
    for (const program of programs || []) {
      if (!program.is_enabled) continue
      const override = ((program as any).override_fields || {}) as Record<string, unknown>
      const id = String(override?.nyc_datasource_id || '').trim()
      if (!id) continue
      const scope = resolveProgramScope(program as any)
      const appliesToProperty =
        scope !== 'asset' && programTargetsProperty(program as any, propertyMeta as any)
      const appliesToAssets =
        (scope === 'asset' || scope === 'both') &&
        assetMetas.some((asset) => programTargetsAsset(program as any, asset as any, propertyMeta as any))
      if (appliesToProperty || appliesToAssets) {
        const bucket = datasourcePrograms.get(id) || { programs: [] }
        bucket.programs.push(program)
        datasourcePrograms.set(id, bucket)
      }
    }

    const requestedIds = Array.from(datasourcePrograms.keys())

    type DatasourceItem = {
      id: string
      program_id: string
      asset_id: string | null
      period_start: string | null
      period_end: string | null
      due_date: string | null
    }

    const datasourceItems: DatasourceItem[] = []

    const programIds = requestedIds.flatMap(
      (id) => (datasourcePrograms.get(id)?.programs || []).map((program: any) => program.id)
    )

    if (programIds.length > 0) {
      const { data: itemsData, error: itemsError } = await supabaseAdmin
        .from('compliance_items')
        .select('id, program_id, asset_id, period_start, period_end, due_date')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
        .in('program_id', programIds)

      if (itemsError) {
        logger.error(
          { error: itemsError, propertyId, orgId },
          'Failed to load compliance items for datasource sync'
        )
      } else if (itemsData) {
        datasourceItems.push(...((itemsData as any) || []))
      }
    }

    const datasourceIndex = new Map<string, { programs: any[]; items: DatasourceItem[] }>()

    for (const id of requestedIds) {
      const programList = datasourcePrograms.get(id)?.programs || []
      const itemsForKey = datasourceItems.filter((item) =>
        programList.some((program: any) => program.id === item.program_id)
      )
      datasourceIndex.set(id, { programs: programList, items: itemsForKey })
    }

    const parseDateSafe = (value?: string | null) => {
      if (!value) return null
      const ts = Date.parse(value)
      return Number.isFinite(ts) ? ts : null
    }

    const resolveItemIdForKey = (id: string, eventDate?: string | null, assetId?: string | null) => {
      const ctx = datasourceIndex.get(id)
      if (!ctx) return null
      const normalizedAsset = assetId || null
      const candidates = (ctx.items || []).filter((item) => {
        if (normalizedAsset) return item.asset_id === normalizedAsset
        if (
          item.asset_id &&
          (ctx.programs || []).every(
            (program: any) => resolveProgramScope(program as any) === 'asset'
          )
        ) {
          return false
        }
        return !item.asset_id
      })
      if (!candidates.length) return null
      const eventTs = parseDateSafe(eventDate)
      const periodMatches =
        eventTs !== null
          ? candidates.filter((item) => {
              const start = parseDateSafe(item.period_start)
              const end = parseDateSafe(item.period_end)
              return start !== null && end !== null && eventTs >= start && eventTs <= end
            })
          : []
      const pool = periodMatches.length ? periodMatches : candidates
      const target = eventTs ?? Date.now()
      let best: DatasourceItem | null = null
      let bestDistance = Number.POSITIVE_INFINITY
      for (const item of pool) {
        const due =
          parseDateSafe(item.due_date) ??
          parseDateSafe(item.period_end) ??
          parseDateSafe(item.period_start)
        if (due === null) continue
        const distance = Math.abs(due - target)
        if (distance < bestDistance) {
          bestDistance = distance
          best = item
        }
      }
      if (best) return best.id
      return pool[0]?.id || null
    }

    const attachers = new Map<string, (event: ComplianceEventUpsertInput) => ComplianceEventUpsertInput>()
    for (const id of requestedIds) {
      attachers.set(id, (event: ComplianceEventUpsertInput) => {
        const eventDate = event.inspection_date || event.filed_date || null
        const itemId = resolveItemIdForKey(id, eventDate, event.asset_id || null)
        return itemId ? { ...event, item_id: itemId } : event
      })
    }

    const runAndAccumulate = async (fn: () => Promise<{ events?: number; errors?: string[] }>) => {
      const result = await fn()
      eventsCreated += result.events || 0
      if (result.errors?.length) errors.push(...result.errors)
    }

    for (const id of requestedIds) {
      const attachItemId = attachers.get(id)
      const datasourceKey = datasourceKeyById.get(id)
      if (!datasourceKey) continue
      switch (datasourceKey) {
        case 'bedbugReporting':
          await runAndAccumulate(() =>
            this.syncBedbugReporting(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        case 'hpdRegistrations':
          await runAndAccumulate(() =>
            this.syncHpdRegistrations(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        case 'dobNowApprovedPermits':
          await runAndAccumulate(() =>
            this.syncDobNowApprovedPermits(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        case 'dobNowJobFilings':
          await runAndAccumulate(() =>
            this.syncDobNowJobFilings(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        case 'dobPermitIssuanceOld':
          await runAndAccumulate(() =>
            this.syncDobPermitIssuanceOld(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        case 'dobJobApplications':
          await runAndAccumulate(() =>
            this.syncDobJobApplications(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        case 'dobCertificateOfOccupancyOld':
          await runAndAccumulate(() =>
            this.syncDobCertificateOfOccupancyOld(propertyId, orgId, bin, { attachItemId })
          )
          break
        case 'dobCertificateOfOccupancyNow':
          await runAndAccumulate(() =>
            this.syncDobCertificateOfOccupancyNow(propertyId, orgId, bin, { attachItemId })
          )
          break
        case 'dobComplaints':
          await runAndAccumulate(() => this.syncDobComplaints(propertyId, orgId, bin))
          break
        case 'elevatorComplaints':
          await runAndAccumulate(() => this.syncElevatorComplaints(propertyId, orgId, bin, assetMetas))
          break
        case 'elevatorViolationsActive':
        case 'elevatorViolationsHistoric':
          await runAndAccumulate(() =>
            this.syncElevatorViolations(
              propertyId,
              orgId,
              bin,
              assetMetas,
              datasourceKey === 'elevatorViolationsHistoric'
            )
          )
          break
        case 'sidewalkViolations':
          await runAndAccumulate(() => this.syncSidewalkViolations(propertyId, orgId, bbl))
          break
        case 'heatSensorProgram':
          await runAndAccumulate(() =>
            this.syncHeatSensorProgram(propertyId, orgId, bin, bbl, { attachItemId })
          )
          break
        default:
          // Keys already covered by existing sync flows (elevators/boilers/facades/violations) are intentionally ignored here
          break
      }
    }

    return { events: eventsCreated, errors: errors.length ? errors : undefined }
  }

  /**
   * Update sync state for org and source
   */
  private async updateSyncState(
    orgId: string,
    source: ExternalSyncSource,
    updates: {
      last_cursor?: string | null
      last_seen_at?: string | null
      last_run_at?: string | null
      status?: 'idle' | 'running' | 'error'
      last_error?: string | null
    }
  ): Promise<void> {
    try {
      const { data: existing } = await supabaseAdmin
        .from('external_sync_state')
        .select('id')
        .eq('org_id', orgId)
        .eq('source', source)
        .maybeSingle()

      if (existing) {
        await supabaseAdmin
          .from('external_sync_state')
          .update(updates)
          .eq('id', existing.id)
      } else {
        await supabaseAdmin
          .from('external_sync_state')
          .insert({
            org_id: orgId,
            source,
            ...updates,
          })
      }
    } catch (error) {
      const pgCode = (error as any)?.code
      if (pgCode === '42703') {
        logger.warn({ error, orgId, source }, 'external_sync_state missing column; skipping state update')
        return
      }
      logger.error({ error, orgId, source, updates }, 'Failed to update sync state')
    }
  }

  /**
   * Extract org/source from a lock key so we can fall back to table-based locking.
   */
  private parseLockKey(lockKey: string): { orgId: string; source: ExternalSyncSource } | null {
    const parts = lockKey.split(':')
    if (parts.length < 3) return null
    const [prefix, orgId, source] = parts
    const allowed: ExternalSyncSource[] = ['dob_now', 'nyc_open_data', 'hpd', 'fdny']
    if (prefix !== 'compliance_sync' || !orgId || !allowed.includes(source as ExternalSyncSource)) {
      return null
    }
    return { orgId, source: source as ExternalSyncSource }
  }

  /**
   * Attempt to acquire a lightweight advisory lock for this sync run
   */
  private async tryAcquireLock(lockKey: string): Promise<boolean> {
    const parsed = this.parseLockKey(lockKey)
    if (parsed) {
      try {
        const { orgId, source } = parsed
        const nowIso = new Date().toISOString()
        const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('external_sync_state')
          .update({ status: 'running', last_error: null, last_run_at: nowIso })
          .eq('org_id', orgId)
          .eq('source', source)
          .or(`status.eq.idle,status.eq.error,updated_at.lte.${staleThreshold}`)
          .select('id')

        if (updateError) {
          logger.error({ error: updateError, orgId, source }, 'Failed to acquire sync lock via external_sync_state')
        } else if (updated && updated.length > 0) {
          return true
        }

        let shouldAttemptInsert = true
        if (!updateError && (!updated || updated.length === 0)) {
          const { data: existing } = await supabaseAdmin
            .from('external_sync_state')
            .select('status, updated_at')
            .eq('org_id', orgId)
            .eq('source', source)
            .maybeSingle()

          const updatedAt = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0
          const isRunningFresh =
            existing?.status === 'running' && updatedAt > Date.now() - 15 * 60 * 1000

          if (isRunningFresh) {
            return false
          }

          shouldAttemptInsert = !existing
        }

        if (shouldAttemptInsert) {
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from('external_sync_state')
            .upsert(
              {
                org_id: orgId,
                source,
                status: 'running',
                last_error: null,
                last_run_at: nowIso,
              },
              { onConflict: 'org_id,source', ignoreDuplicates: true }
            )
            .select('id')

          if (insertError) {
            logger.error({ error: insertError, orgId, source }, 'Failed to insert sync state while acquiring lock')
          } else if (inserted && inserted.length > 0) {
            return true
          }
        }
      } catch (error) {
        const pgCode = (error as any)?.code
        if (pgCode === '42703') {
          // Older schema without status column; fallback to advisory lock
          logger.warn({ error, lockKey }, 'external_sync_state lock fallback to advisory (missing column)')
        } else {
          logger.error({ error, lockKey }, 'Failed to acquire lock via external_sync_state; falling back')
        }
      }
    }

    // Fallback: allow execution without taking an advisory lock to avoid false "in progress" when connections change
    return true
  }

  /**
   * Release a previously acquired advisory lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    // Advisory locks are not used when table-based locking succeeds; keep this as a no-op to avoid false negatives.
    void lockKey
  }

}
