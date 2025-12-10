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
  type ElevatorDevice,
  type ElevatorFiling,
  type BoilerFiling,
  type Violation,
} from './nyc-api-client'
import type {
  ComplianceAssetInsert,
  ComplianceEventInsert,
  ComplianceViolationInsert,
  ComplianceItem,
  ComplianceSyncRequest,
  ComplianceSyncResponse,
  ExternalSyncSource,
} from '@/types/compliance'
import { ComplianceService } from './compliance-service'
import { getNYCOpenDataConfig } from './nyc-open-data/config-manager'

export class ComplianceSyncService {
  private dobNowClient: DOBNowClient
  private nycOpenDataClient: NYCOpenDataClient
  private hpdClient: HPDClient
  private fdnyClient: FDNYClient

  constructor() {
    const clients = createNYCAPIClients()
    this.dobNowClient = clients.dobNow
    this.nycOpenDataClient = clients.nycOpenData
    this.hpdClient = clients.hpd
    this.fdnyClient = clients.fdny
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

      await this.hydrateOpenDataClient(orgId)

      // Sync elevators
      const elevatorResult = bin
        ? await this.syncElevatorsByBIN(bin, propertyId, orgId, force)
        : { assets: 0, events: 0, errors: ['BIN missing, skipped elevators/boilers'] }

      // Sync boilers
      const boilerResult = bin
        ? await this.syncBoilersByBIN(bin, propertyId, orgId, force)
        : { assets: 0, events: 0, errors: ['BIN missing, skipped elevators/boilers'] }

      // Sync violations
      const violationsResult = bin
        ? await this.syncViolationsByBIN(bin, propertyId, orgId, bbl, force)
        : await this.syncViolationsByBIN('', propertyId, orgId, bbl, force)

      // Update compliance items from events
      const itemsUpdated = await this.updateComplianceItemsFromEvents(propertyId, orgId)

      return {
        success: true,
        synced_assets: elevatorResult.assets + boilerResult.assets,
        synced_events: elevatorResult.events + boilerResult.events,
        synced_violations: violationsResult.violations,
        updated_items: itemsUpdated,
        errors: [
          ...(elevatorResult.errors || []),
          ...(boilerResult.errors || []),
          ...(violationsResult.errors || []),
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
    force = false
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

        for (const device of odDevices) {
          const deviceIdentifier = device.deviceNumber || device.deviceId
          try {
            const asset = await this.upsertComplianceAsset(
              {
                property_id: propertyId,
                asset_type: 'elevator',
                name: device.deviceNumber || device.deviceId || 'Elevator',
                external_source: 'nyc_open_data_elevator_device',
                external_source_id: deviceIdentifier,
                metadata: device,
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
                      compliance_status: inspection.status || inspection.result,
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
              const violations = await this.nycOpenDataClient.fetchElevatorViolations(deviceIdentifier, bin)
              for (const violation of violations) {
                try {
                  await this.upsertComplianceViolation(
                    {
                      property_id: propertyId,
                      asset_id: asset.id,
                      agency: 'DOB',
                      violation_number: violation.violationNumber,
                      issue_date: violation.issueDate?.split('T')[0] || violation.issueDate || null,
                      description: violation.description || 'Elevator violation',
                      severity_score: violation.severityScore || null,
                      status:
                        violation.status?.toLowerCase().includes('open') || violation.status === 'active'
                          ? 'open'
                          : violation.status?.toLowerCase().includes('clear')
                          ? 'cleared'
                          : 'closed',
                      cure_by_date: violation.cureByDate ? violation.cureByDate.split('T')[0] : null,
                    },
                    orgId
                  )
                } catch (error) {
                  logger.error({ error, violation }, 'Failed to upsert elevator violation')
                  errors.push(
                    `Failed to sync elevator violation ${violation.violationNumber}: ${
                      error instanceof Error ? error.message : 'Unknown error'
                    }`
                  )
                }
              }
            }
          } catch (error) {
            logger.error({ error, device }, 'Failed to upsert elevator asset (Open Data)')
            errors.push(
              `Failed to sync Open Data device ${deviceIdentifier}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        }

        // 2) DOB NOW filings/in-progress (authoritative for filings)
        const dobDevices = await this.dobNowClient.fetchElevatorDevices(bin)
        for (const device of dobDevices) {
          try {
            const asset = await this.upsertComplianceAsset(
              {
                property_id: propertyId,
                asset_type: 'elevator',
                name: device.deviceNumber || `Elevator ${device.deviceId}`,
                external_source: 'dob_now_elevator_devices',
                external_source_id: device.deviceId,
                metadata: device,
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
    force = false
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
        // Fetch boiler filings
        const filings = await this.dobNowClient.fetchBoilerFilings(bin)

        let assetsCreated = 0
        let eventsCreated = 0
        const errors: string[] = []

        // Check if boiler asset exists, create if not
        const { data: existingBoiler } = await supabaseAdmin
          .from('compliance_assets')
          .select('id')
          .eq('property_id', propertyId)
          .eq('org_id', orgId)
          .eq('asset_type', 'boiler')
          .maybeSingle()

        let boilerAssetId: string | null = null

        if (!existingBoiler && filings.length > 0) {
          // Create boiler asset
          const asset = await this.upsertComplianceAsset(
            {
              property_id: propertyId,
              asset_type: 'boiler',
              name: 'Boiler',
              external_source: 'dob_now_boiler',
              external_source_id: bin,
              metadata: {},
            },
            orgId
          )
          if (asset) {
            boilerAssetId = asset.id
            assetsCreated++
          }
        } else if (existingBoiler) {
          boilerAssetId = existingBoiler.id
        }

        for (const filing of filings) {
          try {
            await this.upsertComplianceEvent(
              {
                property_id: propertyId,
                asset_id: boilerAssetId,
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
          dobViolations,
          dobActiveViolations,
          dobEcbViolations,
          hpdViolations,
          hpdComplaints,
          fdnyViolations,
          asbestosViolations,
        ] = await Promise.all([
          hasBin
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
          hasBin
            ? this.nycOpenDataClient.fetchFDNYViolations(bin).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch FDNY violations')
                return []
              })
            : Promise.resolve([]),
          hasBin
            ? this.nycOpenDataClient.fetchAsbestosViolations(bin).catch((e) => {
                logger.error({ error: e, bin }, 'Failed to fetch asbestos violations')
                return []
              })
            : Promise.resolve([]),
        ])

        const combined = [
          ...dobViolations.map((v) => ({ ...v, agency: 'DOB' })),
          ...dobActiveViolations.map((v) => ({ ...v, agency: 'DOB' })),
          ...dobEcbViolations.map((v) => ({ ...v, agency: 'DOB' })),
          ...hpdViolations.map((v) => ({ ...v, agency: 'HPD' })),
          ...hpdComplaints.map((v) => ({ ...v, agency: 'HPD' })),
          ...fdnyViolations.map((v) => ({ ...v, agency: 'FDNY' })),
          ...asbestosViolations.map((v) => ({ ...v, agency: 'DEP' })),
        ]

        for (const violation of combined) {
          try {
            await this.upsertComplianceViolation(
              {
                property_id: propertyId,
                agency: (violation.agency || 'OTHER') as any,
                violation_number: violation.violationNumber,
                issue_date: violation.issueDate ? violation.issueDate.split('T')[0] : null,
                description: violation.description || 'Violation',
                severity_score: violation.severityScore || null,
                status:
                  violation.status?.toLowerCase().includes('open') || violation.status?.toLowerCase().includes('active')
                    ? 'open'
                    : violation.status?.toLowerCase().includes('clear')
                    ? 'cleared'
                    : 'closed',
                cure_by_date: violation.cureByDate ? violation.cureByDate.split('T')[0] : null,
              },
              orgId
            )
            violationsCreated++
          } catch (error) {
            logger.error({ error, violation }, 'Failed to upsert violation')
            errors.push(
              `Failed to sync violation ${violation.violationNumber}: ${
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
   * Upsert compliance asset (idempotent via external_source + external_source_id)
   */
  private async upsertComplianceAsset(
    data: ComplianceAssetInsert,
    orgId: string
  ): Promise<{ id: string } | null> {
    try {
      const insertData = {
        ...data,
        org_id: orgId,
      }

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
    data: ComplianceEventInsert,
    orgId: string
  ): Promise<void> {
    try {
      const insertData = {
        ...data,
        org_id: orgId,
      }

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
    data: ComplianceViolationInsert,
    orgId: string
  ): Promise<void> {
    try {
      const insertData = {
        ...data,
        org_id: orgId,
      }

      // Check if violation exists
      const { data: existing } = await supabaseAdmin
        .from('compliance_violations')
        .select('id')
        .eq('org_id', orgId)
        .eq('violation_number', data.violation_number)
        .maybeSingle()

      if (existing) {
        // Update existing
        await supabaseAdmin
          .from('compliance_violations')
          .update(insertData)
          .eq('id', existing.id)
        return
      }

      // Insert new
      await supabaseAdmin
        .from('compliance_violations')
        .insert(insertData)
    } catch (error) {
      logger.error({ error, data, orgId }, 'Error in upsertComplianceViolation')
      throw error
    }
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
            p_compliance_status: event.compliance_status,
          }
        )

        if (mapError || !mappedStatus) continue

        // Update item status
        const { error: updateError } = await supabaseAdmin
          .from('compliance_items')
          .update({
            status: mappedStatus,
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
      logger.error({ error, orgId, source, updates }, 'Failed to update sync state')
    }
  }

  /**
   * Attempt to acquire a lightweight advisory lock for this sync run
   */
  private async tryAcquireLock(lockKey: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.rpc('acquire_compliance_lock', {
      lock_key: lockKey,
    })

    if (error) {
      logger.error({ error, lockKey }, 'Failed to acquire advisory lock')
      return false
    }

    return Boolean(data)
  }

  /**
   * Release a previously acquired advisory lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    const { error } = await supabaseAdmin.rpc('release_compliance_lock', {
      lock_key: lockKey,
    })

    if (error) {
      logger.warn({ error, lockKey }, 'Failed to release advisory lock')
    }
  }

}
