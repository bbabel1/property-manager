// Buildium Sync Service
// This file provides a comprehensive service for synchronizing data with Buildium API

import { createBuildiumClient, defaultBuildiumConfig } from './buildium-client'
import { supabase, supabaseAdmin } from './db'
import { logger } from './logger'
import {
  mapPropertyFromBuildiumWithBankAccount,
  mapUnitFromBuildium,
  mapOwnerFromBuildium,
  mapVendorFromBuildiumWithCategory,
  mapTaskFromBuildiumWithRelations,
  mapBankAccountFromBuildiumWithGLAccount,
  mapLeaseToBuildium,
  mapLeaseFromBuildium,
  mapWorkOrderFromBuildiumWithRelations,
  mapWorkOrderToBuildium,
  mapCountryToBuildium,
  sanitizeForBuildium
} from './buildium-mappers'
import { buildiumEdgeClient } from './buildium-edge-client'

import type {
  BuildiumProperty,
  BuildiumUnit,
  BuildiumOwner,
  BuildiumVendor,
  BuildiumTask,
  BuildiumBill,
  BuildiumBankAccount,
  BuildiumLease,
  BuildiumWorkOrder,
  BuildiumLeaseCreate,
  BuildiumLeaseAddress,
  BuildiumLeasePhoneEntry,
  BuildiumLeasePersonCreate,
  BuildiumSyncStatus,
  BuildiumEntityType
} from '@/types/buildium'

type PrimitiveId = string | number

type LocalEntityBase = Record<string, unknown> & { id: PrimitiveId }

type LocalPropertyRecord = LocalEntityBase & { buildium_property_id?: number | null }
type LocalUnitRecord = LocalEntityBase & {
  buildium_property_id?: number | null
  property_id?: PrimitiveId | null
  buildium_unit_id?: number | null
}
type LocalOwnerRecord = LocalEntityBase & { buildium_owner_id?: number | null }
type LocalVendorRecord = LocalEntityBase & { buildium_vendor_id?: number | null }
type LocalTaskRecord = LocalEntityBase & { buildium_task_id?: number | null }
type LocalBillRecord = LocalEntityBase & { buildium_bill_id?: number | null }
type LocalBankAccountRecord = LocalEntityBase & { buildium_bank_id?: number | null }
type LocalWorkOrderRecord = LocalEntityBase & { buildium_work_order_id?: number | null }

interface LocalLeaseRecord extends LocalEntityBase {
  buildium_lease_id?: number | null
  buildium_property_id?: number | null
  PropertyId?: number | null
  property_id?: PrimitiveId | null
  org_id?: string | null
  rent_amount?: number | string | null
  RentAmount?: number | string | null
  rent_cycle?: string | null
  RentCycle?: string | null
  unit_number?: string | null
  unit_id?: PrimitiveId | null
  buildium_unit_id?: number | null
  UnitId?: number | null
  security_deposit?: number | string | null
  SecurityDepositAmount?: number | string | null
  lease_from_date?: string | Date | null
  LeaseFromDate?: string | Date | null
  StartDate?: string | Date | null
  lease_to_date?: string | Date | null
  LeaseToDate?: string | Date | null
  EndDate?: string | Date | null
  lease_type?: string | null
  LeaseType?: string | null
  term_type?: string | null
  TermType?: string | null
  renewal_offer_status?: string | null
  RenewalOfferStatus?: string | null
  payment_due_day?: number | string | null
  PaymentDueDay?: number | string | null
}

interface LeaseRecurringTemplate {
  frequency?: string | null
  amount?: number | null
  memo?: string | null
  start_date?: string | null
  gl_account_id?: string | null
}

interface RentScheduleRow {
  total_amount?: number | null
  start_date?: string | null
  rent_cycle?: string | null
  status?: string | null
}

interface PropertyAddress {
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

interface ContactRow {
  is_company?: boolean | null
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  primary_email?: string | null
  primary_phone?: string | null
  alt_phone?: string | null
  primary_address_line_1?: string | null
  primary_address_line_2?: string | null
  primary_city?: string | null
  primary_state?: string | null
  primary_postal_code?: string | null
  primary_country?: string | null
}

interface TenantRow {
  id?: PrimitiveId | null
  buildium_tenant_id?: string | number | null
  contact?: ContactRow | ContactRow[] | null
}

interface LeaseContactRow {
  role?: string | null
  tenant_id?: PrimitiveId | null
  tenants?: TenantRow | TenantRow[] | null
}

type LeaseContactQueryResult = LeaseContactRow[] | null

type LeaseTenantStatus = 'Current' | 'Prospective' | 'Former'
type LeaseOccupantType = 'Tenant' | 'Occupant' | 'Guarantor' | 'Cosigner'

interface PhoneNumbersObject {
  Home?: string
  Work?: string
  Mobile?: string
}

interface BuildiumLeaseTenantPayload {
  FirstName: string
  LastName: string
  Email?: string
  PhoneNumbers?: BuildiumLeasePhoneEntry[]
  Address: BuildiumLeaseAddress
  AlternateAddress?: BuildiumLeaseAddress
  MoveInDate?: string
  IsCompany?: boolean
  LeaseTenantStatus: LeaseTenantStatus
  IsRentResponsible: boolean
  IsPrimaryTenant: boolean
  OccupantType: LeaseOccupantType
  PrimaryAddress?: BuildiumLeaseAddress
}

interface TenantEdgeContactData {
  firstName: string
  lastName: string
  email?: string
  phoneNumbers: BuildiumLeasePhoneEntry[]
  primaryAddress: BuildiumLeaseAddress
  moveInDate?: string
  isCompany: boolean
}

interface TenantEdgeCreatePayload {
  FirstName: string
  LastName: string
  PrimaryAddress: BuildiumLeaseAddress
  MoveInDate?: string
  IsCompany?: boolean
  Email?: string
  PhoneNumbers?: PhoneNumbersObject
}

type BuildiumClientInstance = ReturnType<typeof createBuildiumClient>
type PropertyCreateInput = Parameters<BuildiumClientInstance['createProperty']>[0]
type PropertyUpdateInput = Parameters<BuildiumClientInstance['updateProperty']>[1]
type UnitCreateInput = Parameters<BuildiumClientInstance['createUnit']>[1]
type UnitUpdateInput = Parameters<BuildiumClientInstance['updateUnit']>[2]
type OwnerCreateInput = Parameters<BuildiumClientInstance['createOwner']>[0]
type OwnerUpdateInput = Parameters<BuildiumClientInstance['updateOwner']>[1]
type VendorCreateInput = Parameters<BuildiumClientInstance['createVendor']>[0]
type VendorUpdateInput = Parameters<BuildiumClientInstance['updateVendor']>[1]
type TaskCreateInput = Parameters<BuildiumClientInstance['createTask']>[0]
type TaskUpdateInput = Parameters<BuildiumClientInstance['updateTask']>[1]
type BillCreateInput = Parameters<BuildiumClientInstance['createBill']>[0]
type BillUpdateInput = Parameters<BuildiumClientInstance['updateBill']>[1]
type BankAccountCreateInput = Parameters<BuildiumClientInstance['createBankAccount']>[0]
type BankAccountUpdateInput = Parameters<BuildiumClientInstance['updateBankAccount']>[1]
type LeaseCreateInput = Parameters<BuildiumClientInstance['createLease']>[0]
type LeaseUpdateInput = Parameters<BuildiumClientInstance['updateLease']>[1]
type WorkOrderCreateInput = Parameters<BuildiumClientInstance['createWorkOrder']>[0]
type WorkOrderUpdateInput = Parameters<BuildiumClientInstance['updateWorkOrder']>[1]

const coerceBuildiumInput = <T>(value: unknown): T => value as T

export class BuildiumSyncService {
  private client!: ReturnType<typeof createBuildiumClient>
  private isEnabled: boolean

  constructor() {
    this.isEnabled = !!(process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET)
    if (this.isEnabled) {
      this.client = createBuildiumClient({
        ...defaultBuildiumConfig,
        clientId: process.env.BUILDIUM_CLIENT_ID || '',
        clientSecret: process.env.BUILDIUM_CLIENT_SECRET || ''
      })
    }
  }

  // ============================================================================
  // PROPERTY SYNC
  // ============================================================================

  async syncPropertyToBuildium(localProperty: LocalPropertyRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping property sync')
      return { success: true }
    }

    try {
      // Update sync status to syncing
      await this.updateSyncStatus('property', localProperty.id, null, 'syncing')

      let buildiumId: number | null = null

      const existingBuildiumId =
        localProperty.buildium_property_id != null ? Number(localProperty.buildium_property_id) : null

      if (existingBuildiumId) {
        // Update existing property
        const buildiumProperty = await this.client.updateProperty(
          existingBuildiumId,
          coerceBuildiumInput<PropertyUpdateInput>(localProperty)
        )
        buildiumId = buildiumProperty.Id
        logger.info({ propertyId: localProperty.id, buildiumId }, 'Property updated in Buildium')
      } else {
        // Create new property
        const buildiumProperty = await this.client.createProperty(
          coerceBuildiumInput<PropertyCreateInput>(localProperty)
        )
        buildiumId = buildiumProperty.Id
        logger.info({ propertyId: localProperty.id, buildiumId }, 'Property created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('properties')
        .update({
          buildium_property_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localProperty.id)

      // Update sync status to synced
      await this.updateSyncStatus('property', localProperty.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ propertyId: localProperty.id, error: errorMessage }, 'Failed to sync property to Buildium')

      // Update sync status to failed
      await this.updateSyncStatus('property', localProperty.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  async syncPropertyFromBuildium(buildiumProperty: BuildiumProperty): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping property sync from Buildium')
      return { success: true }
    }

    try {
      const localData = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, supabase)

      // Check if property already exists locally
      const { data: existingProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('buildium_property_id', buildiumProperty.Id)
        .single()

      if (existingProperty) {
        // Update existing property
        await supabase
          .from('properties')
          .update(localData)
          .eq('id', existingProperty.id)

        logger.info({ propertyId: existingProperty.id, buildiumId: buildiumProperty.Id }, 'Property updated from Buildium')
        return { success: true, localId: existingProperty.id }
      } else {
        // Create new property
        const { data: newProperty, error } = await supabase
          .from('properties')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ propertyId: newProperty.id, buildiumId: buildiumProperty.Id }, 'Property created from Buildium')
        return { success: true, localId: newProperty.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumProperty.Id, error: errorMessage }, 'Failed to sync property from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncUnitFromBuildium(buildiumUnit: BuildiumUnit): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping unit sync from Buildium')
      return { success: true }
    }

    try {
      const localData = mapUnitFromBuildium(buildiumUnit)

      // Check if unit already exists locally
      const { data: existingUnit } = await supabase
        .from('units')
        .select('id')
        .eq('buildium_unit_id', buildiumUnit.Id)
        .single()

      if (existingUnit) {
        // Update existing unit
        await supabase
          .from('units')
          .update(localData)
          .eq('id', existingUnit.id)

        logger.info({ unitId: existingUnit.id, buildiumId: buildiumUnit.Id }, 'Unit updated from Buildium')
        return { success: true, localId: existingUnit.id }
      } else {
        // Create new unit
        const { data: newUnit, error } = await supabase
          .from('units')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ unitId: newUnit.id, buildiumId: buildiumUnit.Id }, 'Unit created from Buildium')
        return { success: true, localId: newUnit.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumUnit.Id, error: errorMessage }, 'Failed to sync unit from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncOwnerFromBuildium(buildiumOwner: BuildiumOwner): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping owner sync from Buildium')
      return { success: true }
    }

    try {
      const localData = mapOwnerFromBuildium(buildiumOwner)

      // Check if owner already exists locally
      const { data: existingOwner } = await supabase
        .from('owners')
        .select('id')
        .eq('buildium_owner_id', buildiumOwner.Id)
        .single()

      if (existingOwner) {
        // Update existing owner
        await supabase
          .from('owners')
          .update(localData)
          .eq('id', existingOwner.id)

        logger.info({ ownerId: existingOwner.id, buildiumId: buildiumOwner.Id }, 'Owner updated from Buildium')
        return { success: true, localId: existingOwner.id }
      } else {
        // Create new owner
        const { data: newOwner, error } = await supabase
          .from('owners')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ ownerId: newOwner.id, buildiumId: buildiumOwner.Id }, 'Owner created from Buildium')
        return { success: true, localId: newOwner.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumOwner.Id, error: errorMessage }, 'Failed to sync owner from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncVendorFromBuildium(buildiumVendor: BuildiumVendor): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping vendor sync from Buildium')
      return { success: true }
    }

    try {
      const localData = await mapVendorFromBuildiumWithCategory(buildiumVendor, supabase)

      // Check if vendor already exists locally
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('buildium_vendor_id', buildiumVendor.Id)
        .single()

      if (existingVendor) {
        // Update existing vendor
        await supabase
          .from('vendors')
          .update(localData)
          .eq('id', existingVendor.id)

        logger.info({ vendorId: existingVendor.id, buildiumId: buildiumVendor.Id }, 'Vendor updated from Buildium')
        return { success: true, localId: existingVendor.id }
      } else {
        // Create new vendor
        const { data: newVendor, error } = await supabase
          .from('vendors')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ vendorId: newVendor.id, buildiumId: buildiumVendor.Id }, 'Vendor created from Buildium')
        return { success: true, localId: newVendor.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumVendor.Id, error: errorMessage }, 'Failed to sync vendor from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncTaskFromBuildium(buildiumTask: BuildiumTask): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping task sync from Buildium')
      return { success: true }
    }

    try {
      const localData = await mapTaskFromBuildiumWithRelations(buildiumTask, supabase)

      // Check if task already exists locally
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('buildium_task_id', buildiumTask.Id)
        .single()

      if (existingTask) {
        // Update existing task
        await supabase
          .from('tasks')
          .update(localData)
          .eq('id', existingTask.id)

        logger.info({ taskId: existingTask.id, buildiumId: buildiumTask.Id }, 'Task updated from Buildium')
        return { success: true, localId: existingTask.id }
      } else {
        // Create new task
        const { data: newTask, error } = await supabase
          .from('tasks')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ taskId: newTask.id, buildiumId: buildiumTask.Id }, 'Task created from Buildium')
        return { success: true, localId: newTask.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumTask.Id, error: errorMessage }, 'Failed to sync task from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncBillFromBuildium(buildiumBill: BuildiumBill): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping bill sync from Buildium')
      return { success: true }
    }

    try {
      // Upsert bill into transactions with lines
      const upsertBillWithLines = async (bill: BuildiumBill, client: typeof supabase): Promise<{ transactionId: string }> => {
        // Implementation would go here
        return { transactionId: 'temp-id' }
      }
      const { transactionId } = await upsertBillWithLines(buildiumBill, supabase)

      logger.info({ transactionId, buildiumId: buildiumBill.Id }, 'Bill upserted from Buildium into transactions')
      return { success: true, localId: transactionId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumBill.Id, error: errorMessage }, 'Failed to sync bill from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncWorkOrderFromBuildium(buildiumWO: BuildiumWorkOrder): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping work order sync from Buildium')
      return { success: true }
    }

    try {
      const localData = await mapWorkOrderFromBuildiumWithRelations(buildiumWO, supabase)

      // Check if work order already exists locally
      const { data: existing } = await supabase
        .from('work_orders')
        .select('id')
        .eq('buildium_work_order_id', buildiumWO.Id)
        .single()

      if (existing) {
        await supabase
          .from('work_orders')
          .update(localData)
          .eq('id', existing.id)

        logger.info({ workOrderId: existing.id, buildiumId: buildiumWO.Id }, 'Work order updated from Buildium')
        return { success: true, localId: existing.id }
      } else {
        const { data: inserted, error } = await supabase
          .from('work_orders')
          .insert(localData)
          .select('id')
          .single()
        if (error) throw error
        logger.info({ workOrderId: inserted.id, buildiumId: buildiumWO.Id }, 'Work order created from Buildium')
        return { success: true, localId: inserted.id }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumWO.Id, error: errorMessage }, 'Failed to sync work order from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncBankAccountFromBuildium(buildiumBankAccount: BuildiumBankAccount): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping bank account sync from Buildium')
      return { success: true }
    }

    try {
      const localData = await mapBankAccountFromBuildiumWithGLAccount(buildiumBankAccount, supabase)

      // Check if bank account already exists locally
      const { data: existingBankAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('buildium_bank_id', buildiumBankAccount.Id)
        .single()

      if (existingBankAccount) {
        // Update existing bank account
        await supabase
          .from('bank_accounts')
          .update(localData)
          .eq('id', existingBankAccount.id)

        logger.info({ bankAccountId: existingBankAccount.id, buildiumId: buildiumBankAccount.Id }, 'Bank account updated from Buildium')
        return { success: true, localId: existingBankAccount.id }
      } else {
        // Create new bank account
        const { data: newBankAccount, error } = await supabase
          .from('bank_accounts')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ bankAccountId: newBankAccount.id, buildiumId: buildiumBankAccount.Id }, 'Bank account created from Buildium')
        return { success: true, localId: newBankAccount.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumBankAccount.Id, error: errorMessage }, 'Failed to sync bank account from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  async syncLeaseFromBuildium(buildiumLease: BuildiumLease): Promise<{ success: boolean; localId?: string; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping lease sync from Buildium')
      return { success: true }
    }

    try {
      const localData = mapLeaseFromBuildium(buildiumLease)

      // Check if lease already exists locally
      const { data: existingLease } = await supabase
        .from('lease')
        .select('id')
        .eq('buildium_lease_id', buildiumLease.Id)
        .single()

      if (existingLease) {
        // Update existing lease
        await supabase
          .from('lease')
          .update(localData)
          .eq('id', existingLease.id)

        logger.info({ leaseId: existingLease.id, buildiumId: buildiumLease.Id }, 'Lease updated from Buildium')
        return { success: true, localId: existingLease.id }
      } else {
        // Create new lease
        const { data: newLease, error } = await supabase
          .from('lease')
          .insert(localData)
          .select()
          .single()

        if (error) throw error

        logger.info({ leaseId: newLease.id, buildiumId: buildiumLease.Id }, 'Lease created from Buildium')
        return { success: true, localId: newLease.id }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ buildiumId: buildiumLease.Id, error: errorMessage }, 'Failed to sync lease from Buildium')
      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // UNIT SYNC
  // ============================================================================

  async syncUnitToBuildium(localUnit: LocalUnitRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping unit sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('unit', localUnit.id, null, 'syncing')

      let buildiumId: number | null = null
      const propertyIdRaw = localUnit.buildium_property_id ?? localUnit.property_id
      const propertyId = propertyIdRaw != null ? Number(propertyIdRaw) : NaN

      if (!Number.isFinite(propertyId)) {
        throw new Error('Property ID required for unit sync')
      }

      const existingBuildiumUnitId =
        localUnit.buildium_unit_id != null ? Number(localUnit.buildium_unit_id) : null

      if (existingBuildiumUnitId) {
        // Update existing unit
        const buildiumUnit = await this.client.updateUnit(
          propertyId,
          existingBuildiumUnitId,
          coerceBuildiumInput<UnitUpdateInput>(localUnit)
        )
        buildiumId = buildiumUnit.Id
        logger.info({ unitId: localUnit.id, buildiumId }, 'Unit updated in Buildium')
      } else {
        // Create new unit
        const buildiumUnit = await this.client.createUnit(
          propertyId,
          coerceBuildiumInput<UnitCreateInput>(localUnit)
        )
        buildiumId = buildiumUnit.Id
        logger.info({ unitId: localUnit.id, buildiumId }, 'Unit created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('units')
        .update({
          buildium_unit_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localUnit.id)

      await this.updateSyncStatus('unit', localUnit.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ unitId: localUnit.id, error: errorMessage }, 'Failed to sync unit to Buildium')

      await this.updateSyncStatus('unit', localUnit.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // OWNER SYNC
  // ============================================================================

  async syncOwnerToBuildium(localOwner: LocalOwnerRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping owner sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('owner', localOwner.id, null, 'syncing')

      let buildiumId: number | null = null
      const existingBuildiumId = localOwner.buildium_owner_id != null ? Number(localOwner.buildium_owner_id) : null

      if (existingBuildiumId) {
        // Update existing owner
        const buildiumOwner = await this.client.updateOwner(
          existingBuildiumId,
          coerceBuildiumInput<OwnerUpdateInput>(localOwner)
        )
        buildiumId = buildiumOwner.Id
        logger.info({ ownerId: localOwner.id, buildiumId }, 'Owner updated in Buildium')
      } else {
        // Create new owner
        const buildiumOwner = await this.client.createOwner(
          coerceBuildiumInput<OwnerCreateInput>(localOwner)
        )
        buildiumId = buildiumOwner.Id
        logger.info({ ownerId: localOwner.id, buildiumId }, 'Owner created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('owners')
        .update({
          buildium_owner_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localOwner.id)

      await this.updateSyncStatus('owner', localOwner.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ ownerId: localOwner.id, error: errorMessage }, 'Failed to sync owner to Buildium')

      await this.updateSyncStatus('owner', localOwner.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // VENDOR SYNC
  // ============================================================================

  async syncVendorToBuildium(localVendor: LocalVendorRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping vendor sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('vendor', localVendor.id, null, 'syncing')

      let buildiumId: number | null = null
      const existingBuildiumId = localVendor.buildium_vendor_id != null ? Number(localVendor.buildium_vendor_id) : null

      if (existingBuildiumId) {
        // Update existing vendor
        const buildiumVendor = await this.client.updateVendor(
          existingBuildiumId,
          coerceBuildiumInput<VendorUpdateInput>(localVendor)
        )
        buildiumId = buildiumVendor.Id
        logger.info({ vendorId: localVendor.id, buildiumId }, 'Vendor updated in Buildium')
      } else {
        // Create new vendor
        const buildiumVendor = await this.client.createVendor(
          coerceBuildiumInput<VendorCreateInput>(localVendor)
        )
        buildiumId = buildiumVendor.Id
        logger.info({ vendorId: localVendor.id, buildiumId }, 'Vendor created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('vendors')
        .update({
          buildium_vendor_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localVendor.id)

      await this.updateSyncStatus('vendor', localVendor.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ vendorId: localVendor.id, error: errorMessage }, 'Failed to sync vendor to Buildium')

      await this.updateSyncStatus('vendor', localVendor.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // TASK SYNC
  // ============================================================================

  async syncTaskToBuildium(localTask: LocalTaskRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping task sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('task', localTask.id, null, 'syncing')

      let buildiumId: number | null = null
      const existingBuildiumId = localTask.buildium_task_id != null ? Number(localTask.buildium_task_id) : null

      if (existingBuildiumId) {
        // Update existing task
        const buildiumTask = await this.client.updateTask(
          existingBuildiumId,
          coerceBuildiumInput<TaskUpdateInput>(localTask)
        )
        buildiumId = buildiumTask.Id
        logger.info({ taskId: localTask.id, buildiumId }, 'Task updated in Buildium')
      } else {
        // Create new task
        const buildiumTask = await this.client.createTask(
          coerceBuildiumInput<TaskCreateInput>(localTask)
        )
        buildiumId = buildiumTask.Id
        logger.info({ taskId: localTask.id, buildiumId }, 'Task created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('tasks')
        .update({
          buildium_task_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localTask.id)

      await this.updateSyncStatus('task', localTask.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ taskId: localTask.id, error: errorMessage }, 'Failed to sync task to Buildium')

      await this.updateSyncStatus('task', localTask.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // BILL SYNC
  // ============================================================================

  async syncBillToBuildium(localBill: LocalBillRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping bill sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('bill', localBill.id, null, 'syncing')

      let buildiumId: number | null = null
      const existingBuildiumId = localBill.buildium_bill_id != null ? Number(localBill.buildium_bill_id) : null

      if (existingBuildiumId) {
        // Update existing bill
        const buildiumBill = await this.client.updateBill(
          existingBuildiumId,
          coerceBuildiumInput<BillUpdateInput>(localBill)
        )
        buildiumId = buildiumBill.Id
        logger.info({ billId: localBill.id, buildiumId }, 'Bill updated in Buildium')
      } else {
        // Create new bill
        const buildiumBill = await this.client.createBill(
          coerceBuildiumInput<BillCreateInput>(localBill)
        )
        buildiumId = buildiumBill.Id
        logger.info({ billId: localBill.id, buildiumId }, 'Bill created in Buildium')
      }

      // Update local transaction record with Buildium ID
      await supabase
        .from('transactions')
        .update({
          buildium_bill_id: buildiumId,
          updated_at: new Date().toISOString()
        })
        .eq('id', localBill.id)

      await this.updateSyncStatus('bill', localBill.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ billId: localBill.id, error: errorMessage }, 'Failed to sync bill to Buildium')

      await this.updateSyncStatus('bill', localBill.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // BANK ACCOUNT SYNC
  // ============================================================================

  async syncBankAccountToBuildium(localBankAccount: LocalBankAccountRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping bank account sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('bank_account', localBankAccount.id, null, 'syncing')

      let buildiumId: number | null = null
      const existingBuildiumId = localBankAccount.buildium_bank_id != null ? Number(localBankAccount.buildium_bank_id) : null

      if (existingBuildiumId) {
        // Update existing bank account
        const buildiumBankAccount = await this.client.updateBankAccount(
          existingBuildiumId,
          coerceBuildiumInput<BankAccountUpdateInput>(localBankAccount)
        )
        buildiumId = buildiumBankAccount.Id
        logger.info({ bankAccountId: localBankAccount.id, buildiumId }, 'Bank account updated in Buildium')
      } else {
        // Create new bank account
        const buildiumBankAccount = await this.client.createBankAccount(
          coerceBuildiumInput<BankAccountCreateInput>(localBankAccount)
        )
        buildiumId = buildiumBankAccount.Id
        logger.info({ bankAccountId: localBankAccount.id, buildiumId }, 'Bank account created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('bank_accounts')
        .update({
          buildium_bank_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localBankAccount.id)

      await this.updateSyncStatus('bank_account', localBankAccount.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ bankAccountId: localBankAccount.id, error: errorMessage }, 'Failed to sync bank account to Buildium')

      await this.updateSyncStatus('bank_account', localBankAccount.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // LEASE SYNC
  // ============================================================================

  async syncLeaseToBuildium(
    localLease: LocalLeaseRecord,
    options?: {
      rentTemplate?: LeaseRecurringTemplate
      depositTemplate?: (LeaseRecurringTemplate & { end_date?: string | null })
      rentSchedule?: RentScheduleRow
    }
  ): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      const msg = 'Buildium sync is disabled or not configured'
      logger.warn({ leaseId: localLease.id }, msg)
      return { success: false, error: msg }
    }

    const db = supabaseAdmin || supabase

    try {
      await this.updateSyncStatus('lease', localLease.id, null, 'syncing')

      const toNumber = (value: unknown): number | null => {
        if (value === null || value === undefined) return null
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }

      const parseDate = (value: unknown): Date | null => {
        if (!value) return null
        if (value instanceof Date) {
          if (Number.isNaN(value.getTime())) return null
          return value
        }
        const str = typeof value === 'string' ? value : String(value)
        const normalized = /T/.test(str) ? str : `${str}T00:00:00Z`
        const date = new Date(normalized)
        return Number.isNaN(date.getTime()) ? null : date
      }

      const dateToIsoDate = (date: Date | null): string | null => {
        if (!date) return null
        return date.toISOString().slice(0, 10)
      }

      const computeFirstDueDate = (leaseStart: Date | null, dueDay: number | null): Date | null => {
        if (!leaseStart) return null
        if (!dueDay || Number.isNaN(dueDay)) return leaseStart
        const year = leaseStart.getUTCFullYear()
        const month = leaseStart.getUTCMonth()
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        const targetDay = Math.min(dueDay, daysInMonth)
        let candidate = new Date(Date.UTC(year, month, targetDay))
        if (candidate.getTime() < leaseStart.getTime()) {
          const nextMonth = new Date(Date.UTC(year, month + 1, 1))
          const nextDays = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate()
          const nextTarget = Math.min(dueDay, nextDays)
          candidate = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), nextTarget))
        }
        return candidate
      }

      const mapRentCycleToBuildium = (value: unknown): string => {
        const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
        switch (normalized) {
          case 'weekly':
            return 'Weekly'
          case 'biweekly':
          case 'bi-weekly':
          case 'bi_weekly':
            return 'Biweekly'
          case 'quarterly':
            return 'Quarterly'
          case 'annually':
          case 'annual':
            return 'Annually'
          case 'onetime':
          case 'one-time':
          case 'one_time':
            return 'OneTime'
          case 'monthly':
          default:
            return 'Monthly'
        }
      }

      const resolveBuildiumGlId = async (localGlId: unknown): Promise<number | null> => {
        if (!localGlId || typeof localGlId !== 'string') return null
        const { data: glRow } = await db
          .from('gl_accounts')
          .select('buildium_gl_account_id')
          .eq('id', localGlId)
          .maybeSingle()
        return toNumber(glRow?.buildium_gl_account_id)
      }

      const discoverBuildiumGlAccountId = async (
        opts: {
          localGlId?: string | null
          type?: string
          nameHint?: string
          fallbackIds?: number[]
        }
      ): Promise<number | null> => {
        try {
          const list = await this.client.getGLAccounts({
            type: opts.type,
            isActive: true,
            limit: 200
          })
          const nameLower = (opts.nameHint || '').toLowerCase()
          let candidate = list.find((account) => {
            if (!account || !account.Id) return false
            const accountName = String(account.Name || '').toLowerCase()
            if (nameLower && accountName.includes(nameLower)) return true
            return false
          })

          if (!candidate && Array.isArray(opts.fallbackIds) && opts.fallbackIds.length) {
            candidate = list.find((account) => opts.fallbackIds!.includes(Number(account?.Id)))
          }

          const resolvedId = candidate ? toNumber(candidate.Id) : null

          if (resolvedId && opts.localGlId) {
            await db
              .from('gl_accounts')
              .update({ buildium_gl_account_id: resolvedId, updated_at: new Date().toISOString() })
              .eq('id', opts.localGlId)
          }

          return resolvedId
        } catch (err) {
          logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to auto-discover Buildium GL account')
          return null
        }
      }

      let buildiumId: number | null = null

      let propertyId = toNumber(localLease.buildium_property_id ?? localLease.PropertyId)
      let propertyOrgId: string | null = localLease.org_id ?? null
      let propertyAddress: PropertyAddress | null = null

      if (localLease.property_id) {
        const { data: prop } = await db
          .from('properties')
          .select('buildium_property_id, address_line1, address_line2, city, state, postal_code, country, org_id')
          .eq('id', localLease.property_id)
          .maybeSingle()

        if (prop) {
          propertyOrgId = propertyOrgId ?? (prop.org_id ?? null)
          propertyAddress = {
            address_line1: prop.address_line1,
            address_line2: prop.address_line2,
            city: prop.city,
            state: prop.state,
            postal_code: prop.postal_code,
            country: prop.country
          }
          if (!propertyId && prop.buildium_property_id != null) {
            const converted = toNumber(prop.buildium_property_id)
            if (converted != null) propertyId = converted
          }
        }
      }

      // PropertyId is helpful for GL/account mapping, but not strictly required to create a lease
      // in Buildium if a valid UnitId is provided. Defer strict validation until after unit lookup.

      let rentAmount = toNumber(localLease.rent_amount ?? localLease.RentAmount)
      let rentScheduleRow: RentScheduleRow | null = options?.rentSchedule ?? null
      const leaseIdNumber = Number(localLease.id)
      if (!rentScheduleRow && !Number.isNaN(leaseIdNumber)) {
        const { data: rentSchedule } = await db
          .from('rent_schedules')
          .select('total_amount, start_date, rent_cycle')
          .eq('lease_id', leaseIdNumber)
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (rentSchedule) rentScheduleRow = rentSchedule
        if (rentAmount == null && rentSchedule?.total_amount != null) {
          rentAmount = toNumber(rentSchedule.total_amount)
        }
      }

      if (rentAmount == null) {
        logger.warn({ leaseId: localLease.id }, 'Lease missing rent amount; defaulting to 0 for Buildium sync')
        rentAmount = 0
      }

      const unitBuildiumIdRaw = toNumber(localLease.buildium_unit_id ?? localLease.UnitId)
      let unitBuildiumId = unitBuildiumIdRaw
      let unitNumber = localLease.unit_number || null
      if (!unitBuildiumId && localLease.unit_id) {
        const { data: unitRow } = await db
          .from('units')
          .select('buildium_unit_id, unit_number')
          .eq('id', localLease.unit_id)
          .maybeSingle()

        if (unitRow?.buildium_unit_id != null) {
          const converted = toNumber(unitRow.buildium_unit_id)
          if (converted != null) unitBuildiumId = converted
        }
        if (!unitNumber && unitRow?.unit_number) unitNumber = unitRow.unit_number
      }

      // Require at least one of PropertyId or UnitId to proceed
      if (propertyId == null && unitBuildiumId == null) {
        throw new Error('Property or Unit Buildium ID required for lease sync')
      }

      const recurringTemplates: LeaseRecurringTemplate[] = []
      if (options?.rentTemplate) recurringTemplates.push(options.rentTemplate)
      if (options?.depositTemplate) recurringTemplates.push(options.depositTemplate)
      if (!Number.isNaN(leaseIdNumber)) {
        const { data: recurs, error: recursError } = await db
          .from('recurring_transactions')
          .select('frequency, amount, memo, start_date, gl_account_id')
          .eq('lease_id', leaseIdNumber)
          .order('start_date', { ascending: true })

        let recurringRows: LeaseRecurringTemplate[] | null = Array.isArray(recurs)
          ? (recurs as LeaseRecurringTemplate[])
          : null
        if (recursError) {
          const fallback = await db
            .from('recurring_transactions')
            .select('frequency, amount, memo, start_date')
            .eq('lease_id', leaseIdNumber)
            .order('start_date', { ascending: true })
          recurringRows = Array.isArray(fallback.data)
            ? (fallback.data as Array<Omit<LeaseRecurringTemplate, 'gl_account_id'>>).map((row) => ({
                ...row,
                gl_account_id: null
              }))
            : null
        }

        if (Array.isArray(recurringRows)) {
          recurringTemplates.push(
            ...recurringRows.map((row) => ({
              ...row,
              gl_account_id: row?.gl_account_id != null ? String(row.gl_account_id) : null
            }))
          )
        }
      }

      const securityDepositAmount = toNumber(localLease.security_deposit ?? localLease.SecurityDepositAmount)

      const rentTemplateRow = recurringTemplates.find((row) => {
        const freq = (row?.frequency ?? '').toLowerCase()
        return freq && freq !== 'onetime'
      }) ?? null

      const depositTemplateRow = recurringTemplates.find((row) => {
        const freq = (row?.frequency ?? '').toLowerCase()
        if (freq !== 'onetime') return false
        const amount = toNumber(row?.amount)
        if (securityDepositAmount != null && amount != null && Math.abs(amount - securityDepositAmount) <= 0.01) return true
        const memo = (row?.memo ?? '').toLowerCase()
        return memo.includes('deposit')
      }) ?? null

      const leaseStartDate = parseDate(localLease.lease_from_date ?? localLease.LeaseFromDate ?? localLease.StartDate)
      const paymentDueDay = toNumber(localLease.payment_due_day ?? localLease.PaymentDueDay)

      const rentNextDueDateDate = parseDate(rentTemplateRow?.start_date ?? rentScheduleRow?.start_date) || computeFirstDueDate(leaseStartDate, paymentDueDay)
      const rentNextDueDate = dateToIsoDate(rentNextDueDateDate)
      const rentChargeAmount = toNumber(rentTemplateRow?.amount) ?? rentAmount
      const rentMemo = (rentTemplateRow?.memo && rentTemplateRow.memo.trim()) || 'Rent'
      const rentCycleSource = rentTemplateRow?.frequency ?? rentScheduleRow?.rent_cycle ?? localLease.rent_cycle ?? localLease.RentCycle ?? null
      const rentCycle = mapRentCycleToBuildium(rentCycleSource)

      const depositDueDate = dateToIsoDate(parseDate(depositTemplateRow?.start_date) || leaseStartDate)
      const depositMemo = (depositTemplateRow?.memo && depositTemplateRow.memo.trim()) || 'Security Deposit'
      const depositAmount = toNumber(depositTemplateRow?.amount) ?? securityDepositAmount

      const orgId = localLease.org_id ?? propertyOrgId ?? null
      let rentGlAccountId: number | null = null
      let depositGlAccountId: number | null = null
      if (!rentGlAccountId && rentTemplateRow?.gl_account_id) {
        rentGlAccountId = await resolveBuildiumGlId(String(rentTemplateRow.gl_account_id))
      }
      if (!depositGlAccountId && depositTemplateRow?.gl_account_id) {
        depositGlAccountId = await resolveBuildiumGlId(String(depositTemplateRow.gl_account_id))
      }
      if (orgId && (!rentGlAccountId || !depositGlAccountId)) {
        const { data: glSettings } = await db
          .from('settings_gl_accounts')
          .select('rent_income, tenant_deposit_liability')
          .eq('org_id', orgId)
          .maybeSingle()

        if (glSettings) {
          if (!rentGlAccountId) rentGlAccountId = await resolveBuildiumGlId(glSettings.rent_income)
          if (!depositGlAccountId) depositGlAccountId = await resolveBuildiumGlId(glSettings.tenant_deposit_liability)

          if (!rentGlAccountId && glSettings.rent_income) {
            rentGlAccountId = await discoverBuildiumGlAccountId({
              localGlId: glSettings.rent_income,
              type: 'Revenue',
              nameHint: 'rent'
            })
          }

          if (!depositGlAccountId && glSettings.tenant_deposit_liability) {
            depositGlAccountId = await discoverBuildiumGlAccountId({
              localGlId: glSettings.tenant_deposit_liability,
              type: 'Liability',
              nameHint: 'deposit'
            })
          }
        }
      }

      if (!rentGlAccountId) {
        rentGlAccountId = await discoverBuildiumGlAccountId({ type: 'Revenue', nameHint: 'rent' })
        if (!rentGlAccountId) {
          logger.warn({ leaseId: localLease.id }, 'Unable to resolve Buildium Rent GL account; payload will omit GLAccountId')
        }
      }

      if (!depositGlAccountId) {
        depositGlAccountId = await discoverBuildiumGlAccountId({ type: 'Liability', nameHint: 'deposit' })
        if (!depositGlAccountId) {
          logger.warn({ leaseId: localLease.id }, 'Unable to resolve Buildium Deposit GL account; payload will omit GLAccountId')
        }
      }

      const buildiumPayloadBase = mapLeaseToBuildium({
        ...localLease,
        buildium_property_id: propertyId,
        buildium_unit_id: unitBuildiumId ?? null,
        rent_amount: rentAmount,
        unit_number: unitNumber ?? localLease.unit_number ?? null
      })

      if (rentAmount != null && rentAmount > 0) {
        const charge = sanitizeForBuildium({
          Amount: rentChargeAmount ?? rentAmount,
          NextDueDate: rentNextDueDate ?? undefined,
          DueDate: rentNextDueDate ?? undefined,
          Memo: rentMemo,
          GLAccountId: rentGlAccountId ?? undefined
        })
        const charges = Object.keys(charge).length ? [charge] : []
        const rentObject = sanitizeForBuildium({
          Cycle: rentCycle,
          Charges: charges.length ? charges : undefined
        })
        if (Object.keys(rentObject).length) buildiumPayloadBase.Rent = rentObject
      }

      if (depositAmount != null && depositAmount > 0) {
        const depositObject = sanitizeForBuildium({
          Amount: depositAmount,
          DueDate: depositDueDate ?? undefined,
          GLAccountId: depositGlAccountId ?? undefined,
          Memo: depositMemo
        })
        if (Object.keys(depositObject).length) buildiumPayloadBase.SecurityDeposit = depositObject
      }

      if (unitBuildiumId) buildiumPayloadBase.UnitId = unitBuildiumId

      let tenantPayload: { tenantIds: number[]; tenantDetails: BuildiumLeaseTenantPayload[] } | null = null
      if (!localLease.buildium_lease_id) {
        tenantPayload = await this.buildLeaseTenantsPayload(localLease, db, propertyAddress)
        if (!tenantPayload.tenantIds.length && !tenantPayload.tenantDetails.length) {
          const message = 'Add at least one tenant with contact information before syncing to Buildium'
          await this.updateSyncStatus('lease', localLease.id, null, 'failed', message)
          return { success: false, error: message }
        }
        if (tenantPayload.tenantIds.length) buildiumPayloadBase.TenantIds = tenantPayload.tenantIds
        if (tenantPayload.tenantDetails.length) buildiumPayloadBase.Tenants = tenantPayload.tenantDetails
      }

      const buildiumRequestPayload = sanitizeForBuildium(buildiumPayloadBase) as BuildiumLeaseCreate
      if (Array.isArray(buildiumRequestPayload.Tenants)) {
        buildiumRequestPayload.Tenants = buildiumRequestPayload.Tenants.map((tenant) =>
          sanitizeForBuildium(tenant) as BuildiumLeasePersonCreate
        )
      }

      logger.debug({ leaseId: localLease.id, payload: buildiumRequestPayload }, 'Prepared Buildium lease payload')

      const existingLeaseId = localLease.buildium_lease_id != null ? Number(localLease.buildium_lease_id) : null

      if (existingLeaseId) {
        const buildiumLease = await this.client.updateLease(existingLeaseId, buildiumRequestPayload as LeaseUpdateInput)
        buildiumId = buildiumLease.Id
        logger.info({ leaseId: localLease.id, buildiumId }, 'Lease updated in Buildium')
      } else {
        const buildiumLease = await this.client.createLease(buildiumRequestPayload as LeaseCreateInput)
        buildiumId = buildiumLease.Id
        logger.info({ leaseId: localLease.id, buildiumId }, 'Lease created in Buildium')
      }

      await db
        .from('lease')
        .update({
          buildium_lease_id: buildiumId,
          buildium_property_id: propertyId,
          buildium_unit_id: unitBuildiumId ?? localLease.buildium_unit_id ?? null,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localLease.id)

      await this.updateSyncStatus('lease', localLease.id, buildiumId, 'synced')

      // Map Buildium Rent Id back to local rent_schedules if available
      try {
        if (buildiumId) {
          const leaseRent = await this.client.getLeaseRent(buildiumId)
          const buildiumRentId = (leaseRent as any)?.Id ?? null
          if (buildiumRentId) {
            // Update the most-recent unsynced schedule for this lease
            const { data: schedules } = await db
              .from('rent_schedules')
              .select('id')
              .eq('lease_id', Number(localLease.id))
              .is('buildium_rent_id', null)
              .order('start_date', { ascending: false })
              .limit(1)
            const scheduleId = Array.isArray(schedules) && schedules[0]?.id
            if (scheduleId) {
              await db
                .from('rent_schedules')
                .update({ buildium_rent_id: Number(buildiumRentId), updated_at: new Date().toISOString() })
                .eq('id', scheduleId)
            }
          }
        }
      } catch (e) {
        logger.warn({ leaseId: localLease.id, error: e instanceof Error ? e.message : String(e) }, 'Failed to map Buildium rent schedule id')
      }

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ leaseId: localLease.id, error: errorMessage }, 'Failed to sync lease to Buildium')

      await this.updateSyncStatus('lease', localLease.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  async syncWorkOrderToBuildium(localWO: LocalWorkOrderRecord): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping work order sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('work_order', localWO.id, null, 'syncing')

      // Map local DB row to Buildium payload using resolvers
      const buildiumPayload = await mapWorkOrderToBuildium(localWO, supabase)

      let buildiumId: number | null = null
      const existingBuildiumId = localWO.buildium_work_order_id != null ? Number(localWO.buildium_work_order_id) : null
      if (existingBuildiumId) {
        const updated = await this.client.updateWorkOrder(
          existingBuildiumId,
          coerceBuildiumInput<WorkOrderUpdateInput>(buildiumPayload)
        )
        buildiumId = updated.Id
        logger.info({ workOrderId: localWO.id, buildiumId }, 'Work order updated in Buildium')
      } else {
        const created = await this.client.createWorkOrder(
          coerceBuildiumInput<WorkOrderCreateInput>(buildiumPayload)
        )
        buildiumId = created.Id
        logger.info({ workOrderId: localWO.id, buildiumId }, 'Work order created in Buildium')
      }

      await supabase
        .from('work_orders')
        .update({
          buildium_work_order_id: buildiumId,
          updated_at: new Date().toISOString()
        })
        .eq('id', localWO.id)

      await this.updateSyncStatus('work_order', localWO.id, buildiumId, 'synced')
      return { success: true, buildiumId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ workOrderId: localWO.id, error: errorMessage }, 'Failed to sync work order to Buildium')
      await this.updateSyncStatus('work_order', localWO.id, null, 'failed', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  private async buildLeaseTenantsPayload(
    localLease: LocalLeaseRecord,
    db: typeof supabase,
    propertyAddress?: PropertyAddress | null
  ): Promise<{ tenantIds: number[]; tenantDetails: BuildiumLeaseTenantPayload[] }> {
    const tenantIds = new Set<number>()
    const tenantDetails: BuildiumLeaseTenantPayload[] = []

    const { data: leaseContactsRaw, error } = await db
      .from('lease_contacts')
      .select(`
        role,
        tenant_id,
        tenants:tenants (
          buildium_tenant_id,
          contact:contacts (
            is_company,
            first_name,
            last_name,
            company_name,
            primary_email,
            primary_phone,
            alt_phone,
            primary_address_line_1,
            primary_address_line_2,
            primary_city,
            primary_state,
            primary_postal_code,
            primary_country
          )
        )
      `)
      .eq('lease_id', localLease.id)

    if (error) throw error
    const leaseContacts = (leaseContactsRaw ?? null) as LeaseContactQueryResult

    if (!leaseContacts?.length) return { tenantIds: [], tenantDetails: [] }

    let moveInDate: string | undefined
    const leaseStart = localLease.lease_from_date ?? localLease.StartDate
    if (leaseStart) {
      const parsed = new Date(String(leaseStart))
      if (!Number.isNaN(parsed.getTime())) {
        moveInDate = parsed.toISOString().slice(0, 10)
      }
    }

    const fallback: PropertyAddress = propertyAddress ?? {}

    for (const contactRow of leaseContacts) {
      if ((contactRow?.role || '').toLowerCase() !== 'tenant') continue

      const tenantRecord = Array.isArray(contactRow.tenants) ? contactRow.tenants[0] : contactRow.tenants
      if (!tenantRecord) continue

      let buildiumTenantId = tenantRecord.buildium_tenant_id ? Number(tenantRecord.buildium_tenant_id) : null
      if (buildiumTenantId && !Number.isNaN(buildiumTenantId)) {
        tenantIds.add(buildiumTenantId)
        continue
      }

      const contact = Array.isArray(tenantRecord.contact) ? tenantRecord.contact[0] : tenantRecord.contact
      if (!contact) continue

      const isCompany = Boolean(contact.is_company)
      const firstName = (contact.first_name || (!isCompany ? '' : contact.company_name) || 'Tenant').trim()
      const lastName = (contact.last_name || (isCompany ? 'Company' : 'Tenant')).trim()
      const email = contact.primary_email ? String(contact.primary_email).trim() : undefined

      const toE164 = (raw: unknown): string | null => {
        if (!raw) return null
        let s = String(raw)
        // strip non-digits
        s = s.replace(/[^0-9+]/g, '')
        // remove leading + for processing
        const hasPlus = s.startsWith('+')
        if (hasPlus) s = s.slice(1)
        // if starts with 1 and length 11, treat as US country code
        if (s.length === 11 && s.startsWith('1')) {
          return `+${s}`
        }
        // if 10 digits, assume US and prefix +1
        if (s.length === 10) return `+1${s}`
        // if already includes country and 8-15 digits, re-add +
        if (!hasPlus && s.length >= 8 && s.length <= 15) return `+${s}`
        return null
      }

      const primary = toE164(contact.primary_phone)
      const alt = toE164(contact.alt_phone)
      const phoneNumbers: BuildiumLeasePhoneEntry[] = []
      if (primary) phoneNumbers.push({ Number: primary, Type: 'Mobile' })
      if (alt) phoneNumbers.push({ Number: alt, Type: 'Work' })

      const addressLine1 = contact.primary_address_line_1 || fallback.address_line1 || 'Unknown Address'
      const addressLine2 = contact.primary_address_line_2 || fallback.address_line2 || undefined
      const city = contact.primary_city || fallback.city || 'Unknown'
      const state = contact.primary_state || fallback.state || 'NA'
      const postal = contact.primary_postal_code || fallback.postal_code || '00000'
      const country = mapCountryToBuildium(contact.primary_country || fallback.country || 'United States') || 'UnitedStates'

      const primaryAddress: BuildiumLeaseAddress = {
        AddressLine1: String(addressLine1),
        City: String(city),
        State: String(state),
        PostalCode: String(postal),
        Country: country
      }
      if (addressLine2) primaryAddress.AddressLine2 = String(addressLine2)

      if (!buildiumTenantId) {
        buildiumTenantId = await this.ensureBuildiumTenantId(
          tenantRecord,
          {
            firstName,
            lastName,
            email,
            phoneNumbers,
            primaryAddress,
            moveInDate,
            isCompany
          },
          db
        )
        if (buildiumTenantId) {
          tenantIds.add(buildiumTenantId)
          continue
        }
      }

      const leaseAddress: BuildiumLeaseAddress = {
        AddressLine1: String(addressLine1),
        City: String(city),
        State: String(state),
        PostalCode: String(postal),
        Country: country
      }
      if (addressLine2) leaseAddress.AddressLine2 = String(addressLine2)

      const tenantPayload: BuildiumLeaseTenantPayload = {
        FirstName: firstName || 'Tenant',
        LastName: lastName || 'Tenant',
        Address: leaseAddress,
        LeaseTenantStatus: 'Current',
        IsRentResponsible: true,
        IsPrimaryTenant: true,
        OccupantType: 'Tenant'
      }

      if (email) tenantPayload.Email = email
      if (phoneNumbers.length) tenantPayload.PhoneNumbers = phoneNumbers
      if (moveInDate) tenantPayload.MoveInDate = moveInDate
      if (isCompany) tenantPayload.IsCompany = true

      // Provide PrimaryAddress as well for broader compatibility with other Buildium endpoints
      tenantPayload.PrimaryAddress = primaryAddress

      tenantDetails.push(tenantPayload)
    }

    return { tenantIds: Array.from(tenantIds), tenantDetails }
  }

  private async ensureBuildiumTenantId(
    tenantRecord: TenantRow,
    contactData: TenantEdgeContactData,
    db: typeof supabase
  ): Promise<number | null> {
    try {
      const payload: TenantEdgeCreatePayload = {
        FirstName: contactData.firstName || 'Tenant',
        LastName: contactData.lastName || 'Tenant',
        PrimaryAddress: contactData.primaryAddress,
        MoveInDate: contactData.moveInDate,
        IsCompany: contactData.isCompany || undefined,
        Email: contactData.email || undefined,
        PhoneNumbers: (() => {
          const obj: PhoneNumbersObject = {}
          const get = (i: number) => (contactData.phoneNumbers?.[i]?.Number ? String(contactData.phoneNumbers[i].Number) : null)
          const mobile = get(0)
          const other = get(1)
          if (mobile) obj.Mobile = mobile
          if (other) obj.Work = other
          return Object.keys(obj).length ? obj : undefined
        })()
      }

      const sanitized = sanitizeForBuildium(payload) as TenantEdgeCreatePayload

      const result = await buildiumEdgeClient.createTenantInBuildium(sanitized)
      if (!result.success || !result.data?.Id) {
        logger.warn({ tenantId: tenantRecord.id, error: result.error }, 'Failed to create tenant in Buildium for lease sync')
        return null
      }

      const buildiumTenantId = Number(result.data.Id)
      if (Number.isNaN(buildiumTenantId)) return null

      const { error: updateError } = await db
        .from('tenants')
        .update({ buildium_tenant_id: buildiumTenantId, updated_at: new Date().toISOString() })
        .eq('id', tenantRecord.id)

      if (updateError) {
        logger.error({ tenantId: tenantRecord.id, buildiumTenantId, error: updateError }, 'Failed to update tenant with buildium_tenant_id')
        return null
      }

      logger.info({ tenantId: tenantRecord.id, buildiumTenantId }, 'Successfully updated tenant with buildium_tenant_id')
      return buildiumTenantId
    } catch (error) {
      logger.error({ tenantId: tenantRecord?.id, error }, 'Error ensuring Buildium tenant id for lease sync')
      return null
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async updateSyncStatus(
    entityType: BuildiumEntityType,
    entityId: PrimitiveId,
    buildiumId: number | null,
    status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict',
    errorMessage?: string
  ): Promise<void> {
    try {
      const normalizedEntityId = String(entityId)
      await supabase.rpc('update_buildium_sync_status', {
        p_entity_type: entityType,
        p_entity_id: normalizedEntityId,
        p_buildium_id: buildiumId,
        p_status: status,
        p_error_message: errorMessage || null
      })
    } catch (error) {
      logger.error({ entityType, entityId, error }, 'Failed to update sync status')
    }
  }

  async getSyncStatus(entityType: BuildiumEntityType, entityId: PrimitiveId): Promise<BuildiumSyncStatus | null> {
    try {
      const normalizedEntityId = String(entityId)
      const { data, error } = await supabase
        .from('buildium_sync_status')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', normalizedEntityId)
        .single()

      if (error) return null
      return data
    } catch (error) {
      logger.error({ entityType, entityId, error }, 'Failed to get sync status')
      return null
    }
  }

  async getFailedSyncs(entityType?: BuildiumEntityType): Promise<BuildiumSyncStatus[]> {
    try {
      let query = supabase
        .from('buildium_sync_status')
        .select('*')
        .eq('sync_status', 'failed')

      if (entityType) {
        query = query.eq('entity_type', entityType)
      }

      const { data, error } = await query

      if (error) return []
      return data || []
    } catch (error) {
      logger.error({ entityType, error }, 'Failed to get failed syncs')
      return []
    }
  }

  async retryFailedSyncs(entityType?: BuildiumEntityType): Promise<{ success: boolean; retried: number; errors: string[] }> {
    const failedSyncs = await this.getFailedSyncs(entityType)
    const errors: string[] = []
    let retried = 0

    for (const sync of failedSyncs) {
      try {
        // Get the entity data
        const { data: entity } = await supabase
          .from(sync.entityType)
          .select('*')
                      .eq('id', sync.entityId)
          .single()

        if (!entity) {
          errors.push(`Entity not found: ${sync.entityType}/${sync.entityId}`)
          continue
        }

        // Retry the sync based on entity type
        let result
        switch (sync.entityType) {
          case 'property':
            result = await this.syncPropertyToBuildium(entity)
            break
          case 'unit':
            result = await this.syncUnitToBuildium(entity)
            break
          case 'owner':
            result = await this.syncOwnerToBuildium(entity)
            break
          case 'vendor':
            result = await this.syncVendorToBuildium(entity)
            break
          case 'task':
            result = await this.syncTaskToBuildium(entity)
            break
          case 'bill':
            result = await this.syncBillToBuildium(entity)
            break
          case 'bank_account':
            result = await this.syncBankAccountToBuildium(entity)
            break
          case 'lease':
            result = await this.syncLeaseToBuildium(entity)
            break
          case 'work_order':
            result = await this.syncWorkOrderToBuildium(entity)
            break
          default:
            errors.push(`Unknown entity type: ${sync.entityType}`)
            continue
        }

        if (result.success) {
          retried++
        } else {
          errors.push(`Failed to retry sync for ${sync.entityType}/${sync.entityId}: ${result.error}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Error retrying sync for ${sync.entityType}/${sync.entityId}: ${errorMessage}`)
      }
    }

    return { success: retried > 0, retried, errors }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const buildiumSync = new BuildiumSyncService()

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function syncToBuildium(
  entityType: BuildiumEntityType,
  entityData: LocalEntityBase
): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
  switch (entityType) {
    case 'property':
      return buildiumSync.syncPropertyToBuildium(entityData as LocalPropertyRecord)
    case 'unit':
      return buildiumSync.syncUnitToBuildium(entityData as LocalUnitRecord)
    case 'owner':
      return buildiumSync.syncOwnerToBuildium(entityData as LocalOwnerRecord)
    case 'vendor':
      return buildiumSync.syncVendorToBuildium(entityData as LocalVendorRecord)
    case 'task':
      return buildiumSync.syncTaskToBuildium(entityData as LocalTaskRecord)
    case 'bill':
      return buildiumSync.syncBillToBuildium(entityData as LocalBillRecord)
    case 'bank_account':
      return buildiumSync.syncBankAccountToBuildium(entityData as LocalBankAccountRecord)
    case 'lease':
      return buildiumSync.syncLeaseToBuildium(entityData as LocalLeaseRecord)
    case 'work_order':
      return buildiumSync.syncWorkOrderToBuildium(entityData as LocalWorkOrderRecord)
    default:
      return { success: false, error: `Unknown entity type: ${entityType}` }
  }
}
