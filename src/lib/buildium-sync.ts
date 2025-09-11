// Buildium Sync Service
// This file provides a comprehensive service for synchronizing data with Buildium API

import { createBuildiumClient, defaultBuildiumConfig } from './buildium-client'
import { supabase } from './db'
import { logger } from './logger'
import {
  mapPropertyToBuildium,
  mapPropertyFromBuildiumWithBankAccount,
  mapUnitToBuildium,
  mapUnitFromBuildium,
  mapOwnerToBuildium,
  mapOwnerFromBuildium,
  mapVendorToBuildium,
  mapVendorFromBuildium,
  mapVendorFromBuildiumWithCategory,
  mapTaskToBuildium,
  mapTaskFromBuildium,
  mapTaskFromBuildiumWithRelations,
  mapBillToBuildium,
  mapBillFromBuildium,
  mapBankAccountToBuildium,
  mapBankAccountFromBuildiumWithGLAccount,
  mapLeaseToBuildium,
  mapLeaseFromBuildium,
  mapWorkOrderFromBuildium,
  mapWorkOrderFromBuildiumWithRelations,
  mapWorkOrderToBuildium,
  sanitizeForBuildium,
  validateBuildiumResponse,
  extractBuildiumId
} from './buildium-mappers'

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
  BuildiumSyncStatus,
  BuildiumEntityType
} from '@/types/buildium'

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

  async syncPropertyToBuildium(localProperty: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping property sync')
      return { success: true }
    }

    try {
      // Update sync status to syncing
      await this.updateSyncStatus('property', localProperty.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localProperty.buildium_property_id) {
        // Update existing property
        const buildiumProperty = await this.client.updateProperty(localProperty.buildium_property_id, localProperty)
        buildiumId = buildiumProperty.Id
        logger.info({ propertyId: localProperty.id, buildiumId }, 'Property updated in Buildium')
      } else {
        // Create new property
        const buildiumProperty = await this.client.createProperty(localProperty)
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
      const { upsertBillWithLines } = await import('./buildium-mappers')
      const { transactionId } = await upsertBillWithLines(buildiumBill as any, supabase)

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

  async syncUnitToBuildium(localUnit: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping unit sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('unit', localUnit.id, null, 'syncing')

      let buildiumId: number | null = null
      const propertyId = localUnit.buildium_property_id || localUnit.property_id

      if (!propertyId) {
        throw new Error('Property ID required for unit sync')
      }

      if (localUnit.buildium_unit_id) {
        // Update existing unit
        const buildiumUnit = await this.client.updateUnit(propertyId, localUnit.buildium_unit_id, localUnit)
        buildiumId = buildiumUnit.Id
        logger.info({ unitId: localUnit.id, buildiumId }, 'Unit updated in Buildium')
      } else {
        // Create new unit
        const buildiumUnit = await this.client.createUnit(propertyId, localUnit)
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

  async syncOwnerToBuildium(localOwner: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping owner sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('owner', localOwner.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localOwner.buildium_owner_id) {
        // Update existing owner
        const buildiumOwner = await this.client.updateOwner(localOwner.buildium_owner_id, localOwner)
        buildiumId = buildiumOwner.Id
        logger.info({ ownerId: localOwner.id, buildiumId }, 'Owner updated in Buildium')
      } else {
        // Create new owner
        const buildiumOwner = await this.client.createOwner(localOwner)
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

  async syncVendorToBuildium(localVendor: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping vendor sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('vendor', localVendor.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localVendor.buildium_vendor_id) {
        // Update existing vendor
        const buildiumVendor = await this.client.updateVendor(localVendor.buildium_vendor_id, localVendor)
        buildiumId = buildiumVendor.Id
        logger.info({ vendorId: localVendor.id, buildiumId }, 'Vendor updated in Buildium')
      } else {
        // Create new vendor
        const buildiumVendor = await this.client.createVendor(localVendor)
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

  async syncTaskToBuildium(localTask: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping task sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('task', localTask.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localTask.buildium_task_id) {
        // Update existing task
        const buildiumTask = await this.client.updateTask(localTask.buildium_task_id, localTask)
        buildiumId = buildiumTask.Id
        logger.info({ taskId: localTask.id, buildiumId }, 'Task updated in Buildium')
      } else {
        // Create new task
        const buildiumTask = await this.client.createTask(localTask)
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

  async syncBillToBuildium(localBill: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping bill sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('bill', localBill.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localBill.buildium_bill_id) {
        // Update existing bill
        const buildiumBill = await this.client.updateBill(localBill.buildium_bill_id, localBill)
        buildiumId = buildiumBill.Id
        logger.info({ billId: localBill.id, buildiumId }, 'Bill updated in Buildium')
      } else {
        // Create new bill
        const buildiumBill = await this.client.createBill(localBill)
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

  async syncBankAccountToBuildium(localBankAccount: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping bank account sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('bank_account', localBankAccount.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localBankAccount.buildium_bank_id) {
        // Update existing bank account
        const buildiumBankAccount = await this.client.updateBankAccount(localBankAccount.buildium_bank_id, localBankAccount)
        buildiumId = buildiumBankAccount.Id
        logger.info({ bankAccountId: localBankAccount.id, buildiumId }, 'Bank account updated in Buildium')
      } else {
        // Create new bank account
        const buildiumBankAccount = await this.client.createBankAccount(localBankAccount)
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

  async syncLeaseToBuildium(localLease: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping lease sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('lease', localLease.id, null, 'syncing')

      let buildiumId: number | null = null

      if (localLease.buildium_lease_id) {
        // Update existing lease
        const buildiumLease = await this.client.updateLease(localLease.buildium_lease_id, localLease)
        buildiumId = buildiumLease.Id
        logger.info({ leaseId: localLease.id, buildiumId }, 'Lease updated in Buildium')
      } else {
        // Create new lease
        const buildiumLease = await this.client.createLease(localLease)
        buildiumId = buildiumLease.Id
        logger.info({ leaseId: localLease.id, buildiumId }, 'Lease created in Buildium')
      }

      // Update local record with Buildium ID
      await supabase
        .from('lease')
        .update({
          buildium_lease_id: buildiumId,
          buildium_created_at: new Date().toISOString(),
          buildium_updated_at: new Date().toISOString()
        })
        .eq('id', localLease.id)

      await this.updateSyncStatus('lease', localLease.id, buildiumId, 'synced')

      return { success: true, buildiumId }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ leaseId: localLease.id, error: errorMessage }, 'Failed to sync lease to Buildium')

      await this.updateSyncStatus('lease', localLease.id, null, 'failed', errorMessage)

      return { success: false, error: errorMessage }
    }
  }

  async syncWorkOrderToBuildium(localWO: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
    if (!this.isEnabled) {
      logger.info('Buildium sync disabled, skipping work order sync')
      return { success: true }
    }

    try {
      await this.updateSyncStatus('work_order', localWO.id, null, 'syncing')

      // Map local DB row to Buildium payload using resolvers
      const buildiumPayload = await mapWorkOrderToBuildium(localWO, supabase)

      let buildiumId: number | null = null
      if (localWO.buildium_work_order_id) {
        const updated = await this.client.updateWorkOrder(localWO.buildium_work_order_id, buildiumPayload as any)
        buildiumId = updated.Id
        logger.info({ workOrderId: localWO.id, buildiumId }, 'Work order updated in Buildium')
      } else {
        const created = await this.client.createWorkOrder(buildiumPayload as any)
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

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async updateSyncStatus(
    entityType: BuildiumEntityType,
    entityId: string,
    buildiumId: number | null,
    status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict',
    errorMessage?: string
  ): Promise<void> {
    try {
      await supabase.rpc('update_buildium_sync_status', {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_buildium_id: buildiumId,
        p_status: status,
        p_error_message: errorMessage || null
      })
    } catch (error) {
      logger.error({ entityType, entityId, error }, 'Failed to update sync status')
    }
  }

  async getSyncStatus(entityType: BuildiumEntityType, entityId: string): Promise<BuildiumSyncStatus | null> {
    try {
      const { data, error } = await supabase
        .from('buildium_sync_status')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
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

export async function syncToBuildium(entityType: BuildiumEntityType, entityData: any): Promise<{ success: boolean; buildiumId?: number; error?: string }> {
  switch (entityType) {
    case 'property':
      return buildiumSync.syncPropertyToBuildium(entityData)
    case 'unit':
      return buildiumSync.syncUnitToBuildium(entityData)
    case 'owner':
      return buildiumSync.syncOwnerToBuildium(entityData)
    case 'vendor':
      return buildiumSync.syncVendorToBuildium(entityData)
    case 'task':
      return buildiumSync.syncTaskToBuildium(entityData)
    case 'bill':
      return buildiumSync.syncBillToBuildium(entityData)
    case 'bank_account':
      return buildiumSync.syncBankAccountToBuildium(entityData)
    case 'lease':
      return buildiumSync.syncLeaseToBuildium(entityData)
    case 'work_order':
      return buildiumSync.syncWorkOrderToBuildium(entityData)
    default:
      return { success: false, error: `Unknown entity type: ${entityType}` }
  }
}
