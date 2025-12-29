// Buildium Edge Function Client
// This client calls the Supabase Edge Functions instead of direct Buildium API

import { supabase } from './db'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { BuildiumConfig } from '@/lib/buildium/credentials-manager'
import type {
  BuildiumTenant,
  BuildiumTenantNote,
  BuildiumLeaseTransaction,
  BuildiumLeaseTransactionCreate,
  BuildiumLeaseTransactionUpdate,
  BuildiumRecurringTransaction,
  BuildiumRecurringTransactionCreate,
  BuildiumRecurringTransactionUpdate,
  BuildiumProperty,
  BuildiumOwner,
  BuildiumWorkOrder,
  BuildiumAppliance,
  BuildiumLease,
  BuildiumGLAccount,
  BuildiumBankAccount,
  BuildiumPropertyImage,
} from '@/types/buildium'

type EdgeResult<T = unknown> = { success: boolean; data?: T; error?: string }
type EdgeListResult<T = unknown> = { success: boolean; data?: T[]; error?: string }
type EdgeSyncResult = { success: boolean; synced?: number; updated?: number; failed?: number; error?: string }
type EdgeDeleteResult = { success: boolean; deleted?: boolean; error?: string }
type EdgeIdResult = { success: boolean; buildiumId?: number; error?: string }

export class BuildiumEdgeClient {
  private supabaseUrl: string
  private credentials?: { baseUrl: string; clientId: string; clientSecret: string }

  constructor(creds?: Pick<BuildiumConfig, 'baseUrl' | 'clientId' | 'clientSecret'>) {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    if (creds?.clientId && creds?.clientSecret) {
      this.credentials = {
        baseUrl: (creds.baseUrl || 'https://apisandbox.buildium.com/v1').replace(/\/$/, ''),
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
      }
    } else if (process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET) {
      this.credentials = {
        baseUrl: (process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1').replace(/\/$/, ''),
        clientId: process.env.BUILDIUM_CLIENT_ID,
        clientSecret: process.env.BUILDIUM_CLIENT_SECRET,
      }
    }
  }

  /**
   * Helper method to add credentials to request body
   */
  private withCreds<T extends Record<string, unknown>>(body: T): T & { credentials?: BuildiumEdgeClient['credentials'] } {
    return { ...body, credentials: this.credentials }
  }

  // ============================================================================
  // TENANTS VIA EDGE FUNCTIONS
  // ============================================================================

  async listTenantsFromBuildium(params?: {
    lastupdatedfrom?: string
    lastupdatedto?: string
    orderby?: string
    offset?: number
    limit?: number
  }): Promise<EdgeListResult<BuildiumTenant>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenant', operation: 'list', entityData: params || {} }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async syncTenantsFromBuildium(params?: {
    lastupdatedfrom?: string
    lastupdatedto?: string
    orderby?: string
    offset?: number
    limit?: number
  }): Promise<EdgeSyncResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenant', operation: 'syncFromBuildium', entityData: params || {} }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, synced: data.synced, updated: data.updated }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createTenantInBuildium(payload: Record<string, unknown>): Promise<EdgeResult<BuildiumTenant>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenant', operation: 'create', entityData: payload }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateTenantInBuildium(id: number, payload: Record<string, unknown>): Promise<EdgeResult<BuildiumTenant>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenant', operation: 'update', entityData: { ...payload, Id: id, buildium_tenant_id: id } }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getTenantFromBuildium(id: number): Promise<EdgeResult<BuildiumTenant>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ method: 'GET', entityType: 'tenant', entityId: id }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async listTenantNotesFromBuildium(tenantId: number, params?: { limit?: number; offset?: number; orderby?: string }): Promise<EdgeListResult<BuildiumTenantNote>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenantNote', operation: 'list', entityData: { tenantId, ...(params || {}) } }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createTenantNoteInBuildium(tenantId: number, payload: Record<string, unknown>): Promise<EdgeResult<BuildiumTenantNote>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenantNote', operation: 'create', entityData: { tenantId, ...payload } }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateTenantNoteInBuildium(tenantId: number, noteId: number, payload: Record<string, unknown>): Promise<EdgeResult<BuildiumTenantNote>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', {
        body: this.withCreds({ entityType: 'tenantNote', operation: 'update', entityData: { tenantId, noteId, ...payload } }),
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  // ============================================================================
  // LEASE TRANSACTIONS VIA EDGE FUNCTIONS
  // ============================================================================

  async listLeaseTransactions(leaseId: number, params?: { orderby?: string; offset?: number; limit?: number; dateFrom?: string; dateTo?: string }): Promise<EdgeListResult<BuildiumLeaseTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'list', leaseId, ...(params || {}), credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getLeaseTransaction(leaseId: number, transactionId: number, persist = false): Promise<EdgeResult<BuildiumLeaseTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'get', leaseId, transactionId, persist, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createLeaseTransaction(leaseId: number, payload: BuildiumLeaseTransactionCreate | Record<string, unknown>, persist = true): Promise<EdgeResult<BuildiumLeaseTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'create', leaseId, payload, persist, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateLeaseTransaction(leaseId: number, transactionId: number, payload: BuildiumLeaseTransactionUpdate | Record<string, unknown>, persist = true): Promise<EdgeResult<BuildiumLeaseTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'update', leaseId, transactionId, payload, persist, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async listRecurringLeaseTransactions(leaseId: number): Promise<EdgeListResult<BuildiumRecurringTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'listRecurring', leaseId, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getRecurringLeaseTransaction(leaseId: number, recurringId: number): Promise<EdgeResult<BuildiumRecurringTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'getRecurring', leaseId, recurringId, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createRecurringLeaseTransaction(leaseId: number, payload: BuildiumRecurringTransactionCreate | Record<string, unknown>): Promise<EdgeResult<BuildiumRecurringTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'createRecurring', leaseId, payload, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateRecurringLeaseTransaction(leaseId: number, recurringId: number, payload: BuildiumRecurringTransactionUpdate | Record<string, unknown>): Promise<EdgeResult<BuildiumRecurringTransaction>>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'updateRecurring', leaseId, recurringId, payload, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async deleteRecurringLeaseTransaction(leaseId: number, recurringId: number): Promise<EdgeDeleteResult>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-lease-transactions-api', {
        body: { action: 'deleteRecurring', leaseId, recurringId, credentials: this.credentials }
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, deleted: !!data.data?.deleted }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }
  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  async syncPropertyToBuildium(propertyData: Record<string, unknown>): Promise<EdgeIdResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'property',
          entityData: propertyData,
          operation: propertyData.buildium_property_id ? 'update' : 'create',
          credentials: this.credentials,
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { 
          success: true, 
          buildiumId: data.data?.Id || propertyData.buildium_property_id 
        }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync property via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async syncOwnerToBuildium(ownerData: Record<string, unknown>): Promise<EdgeIdResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'owner',
          entityData: ownerData,
          operation: ownerData.buildium_owner_id ? 'update' : 'create',
          credentials: this.credentials,
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { 
          success: true, 
          buildiumId: data.data?.Id || ownerData.buildium_owner_id 
        }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync owner via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getPropertyFromBuildium(propertyId: number): Promise<EdgeResult<BuildiumProperty>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          method: 'GET',
          entityType: 'property',
          entityId: propertyId
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get property via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getOwnerFromBuildium(ownerId: number): Promise<EdgeResult<BuildiumOwner>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          method: 'GET',
          entityType: 'owner',
          entityId: ownerId
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get owner via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // WORK ORDERS VIA EDGE FUNCTIONS
  // ============================================================================

  async listWorkOrdersFromBuildium(params?: {
    propertyId?: number
    unitId?: number
    status?: string
    categoryId?: number
    limit?: number
    offset?: number
  }): Promise<EdgeListResult<BuildiumWorkOrder>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'workOrder',
          operation: 'list',
          entityData: params || {}
        })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  async syncWorkOrdersFromBuildium(params?: {
    propertyId?: number
    unitId?: number
    status?: string
    categoryId?: number
    limit?: number
    offset?: number
  }): Promise<EdgeSyncResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'workOrder',
          operation: 'syncFromBuildium',
          entityData: params || {}
        })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, synced: data.synced, updated: data.updated }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  async createWorkOrderInBuildium(payload: Record<string, unknown>): Promise<EdgeResult<BuildiumWorkOrder>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'workOrder',
          operation: 'create',
          entityData: payload
        })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  async updateWorkOrderInBuildium(id: number, payload: Record<string, unknown>): Promise<EdgeResult<BuildiumWorkOrder>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'workOrder',
          operation: 'update',
          entityData: { ...payload, Id: id, buildium_work_order_id: id }
        })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  async syncWorkOrderToBuildium(local: Record<string, unknown>): Promise<EdgeResult<BuildiumWorkOrder>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'workOrder',
          operation: 'syncToBuildium',
          entityData: local
        })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ============================================================================
  // APPLIANCES VIA EDGE FUNCTIONS
  // ============================================================================

  async listAppliancesFromBuildium(params?: {
    propertyId?: number
    unitId?: number
    applianceType?: string
    limit?: number
    offset?: number
  }): Promise<EdgeListResult<BuildiumAppliance>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'appliance', operation: 'list', entityData: params || {} })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  // ============================================================================
  // LEASES VIA EDGE FUNCTIONS
  // ============================================================================

  async listLeasesFromBuildium(params?: {
    propertyids?: number[]
    unitids?: number[]
    lastupdatedfrom?: string
    lastupdatedto?: string
    orderby?: string
    offset?: number
    limit?: number
  }): Promise<EdgeListResult<BuildiumLease>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'lease', operation: 'list', entityData: params || {} })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getLeaseFromBuildium(leaseId: number): Promise<EdgeResult<BuildiumLease>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'lease', operation: 'get', entityData: { Id: leaseId } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async syncLeasesFromBuildium(params?: {
    propertyids?: number[]; unitids?: number[]; lastupdatedfrom?: string; lastupdatedto?: string; orderby?: string; offset?: number; limit?: number
  }): Promise<EdgeSyncResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'lease', operation: 'syncFromBuildium', entityData: params || {} })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, synced: data.synced, updated: data.updated, failed: data.failed }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createLeaseInBuildium(payload: Record<string, unknown>): Promise<EdgeResult<BuildiumLease>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'lease', operation: 'create', entityData: payload })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateLeaseInBuildium(id: number, payload: Record<string, unknown>): Promise<EdgeResult<BuildiumLease>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'lease', operation: 'update', entityData: { ...payload, Id: id, buildium_lease_id: id } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  // ============================================================================
  // LEASE NOTES VIA EDGE FUNCTIONS
  // ============================================================================

  async listLeaseNotes(leaseId: number, params?: { limit?: number; offset?: number; orderby?: string }): Promise<EdgeListResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseNote', operation: 'list', entityData: { leaseId, ...(params || {}) } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getLeaseNote(leaseId: number, noteId: number): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseNote', operation: 'get', entityData: { leaseId, noteId } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createLeaseNote(leaseId: number, payload: Record<string, unknown>): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseNote', operation: 'create', entityData: { leaseId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateLeaseNote(leaseId: number, noteId: number, payload: Record<string, unknown>): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseNote', operation: 'update', entityData: { leaseId, noteId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  // ============================================================================
  // LEASE RECURRING TRANSACTIONS VIA EDGE FUNCTIONS
  // ============================================================================

  async listLeaseRecurringTransactions(leaseId: number, params?: { limit?: number; offset?: number; orderby?: string }): Promise<EdgeListResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseRecurring', operation: 'list', entityData: { leaseId, ...(params || {}) } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getLeaseRecurringTransaction(leaseId: number, recurringId: number): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseRecurring', operation: 'get', entityData: { leaseId, recurringId } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createLeaseRecurringTransaction(leaseId: number, payload: Record<string, unknown>): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseRecurring', operation: 'create', entityData: { leaseId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateLeaseRecurringTransaction(leaseId: number, recurringId: number, payload: Record<string, unknown>): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseRecurring', operation: 'update', entityData: { leaseId, recurringId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async deleteLeaseRecurringTransaction(leaseId: number, recurringId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseRecurring', operation: 'delete', entityData: { leaseId, recurringId } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  // ============================================================================
  // LEASE MOVE OUTS VIA EDGE FUNCTIONS
  // ============================================================================

  async listLeaseMoveOuts(leaseId: number, params?: { limit?: number; offset?: number; orderby?: string }): Promise<EdgeListResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseMoveOut', operation: 'list', entityData: { leaseId, ...(params || {}) } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async getLeaseMoveOut(leaseId: number, moveOutId: number): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseMoveOut', operation: 'get', entityData: { leaseId, moveOutId } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createLeaseMoveOut(leaseId: number, payload: Record<string, unknown>): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseMoveOut', operation: 'create', entityData: { leaseId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async deleteLeaseMoveOut(leaseId: number, moveOutId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'leaseMoveOut', operation: 'delete', entityData: { leaseId, moveOutId } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async syncAppliancesFromBuildium(params?: {
    propertyId?: number
    unitId?: number
    applianceType?: string
    limit?: number
    offset?: number
  }): Promise<EdgeSyncResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'appliance', operation: 'syncFromBuildium', entityData: params || {} })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, synced: data.synced, updated: data.updated }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createApplianceInBuildium(payload: Record<string, unknown>): Promise<EdgeResult<BuildiumAppliance>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'appliance', operation: 'create', entityData: payload })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateApplianceInBuildium(id: number, payload: Record<string, unknown>): Promise<EdgeResult<BuildiumAppliance>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'appliance', operation: 'update', entityData: { ...payload, Id: id, buildium_appliance_id: id } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async listApplianceServiceHistory(applianceId: number, params?: { limit?: number; offset?: number }): Promise<EdgeListResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'applianceServiceHistory', operation: 'list', entityData: { applianceId, ...(params || {}) } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data || [] }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async createApplianceServiceHistory(applianceId: number, payload: Record<string, unknown>): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'applianceServiceHistory', operation: 'create', entityData: { applianceId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  async updateApplianceServiceHistory(applianceId: number, serviceHistoryId: number, payload: Record<string, unknown>): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ entityType: 'applianceServiceHistory', operation: 'update', entityData: { applianceId, serviceHistoryId, ...payload } })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) { return { success: false, error: (e as Error).message } }
  }

  // SYNC STATUS OPERATIONS
  // ============================================================================

  async getSyncStatus(entityType: string, entityId: string): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: { method: 'GET', entityType, entityId },
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get sync status via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getFailedSyncs(entityType?: string): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: { method: 'GET', entityType },
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get failed syncs via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async retryFailedSyncs(entityType?: string): Promise<EdgeResult> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: { method: 'POST', entityType },
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to retry failed syncs via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // BANK ACCOUNT OPERATIONS
  // ============================================================================

  async syncBankAccountsFromBuildium(options: { forceSync?: boolean } = {}): Promise<EdgeResult<{ synced?: number; updated?: number }>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'bankAccount',
          operation: 'syncFromBuildium',
          options,
          credentials: this.credentials,
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync bank accounts via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // ============================================================================
  // GENERAL LEDGER OPERATIONS
  // ============================================================================

  async syncGLAccountsFromBuildium(options: { type?: string; subType?: string; isActive?: boolean; limit?: number; offset?: number } = {}): Promise<EdgeResult<{ synced?: number; updated?: number }>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'glAccount',
          operation: 'syncFromBuildium',
          ...options
        })
      })

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { success: false, error: msg }
    }
  }

  async syncGLEntriesFromBuildium(options: { dateFrom?: string; dateTo?: string; glAccountId?: number; limit?: number; offset?: number; overlapDays?: number } = {}): Promise<EdgeResult<{ synced?: number; updated?: number }>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'glEntry',
          operation: 'syncFromBuildium',
          ...options
        })
      })

      if (error) return { success: false, error: error.message }
      return { success: true, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { success: false, error: msg }
    }
  }

  async getGLAccountFromBuildium(id: number): Promise<EdgeResult<BuildiumGLAccount>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({ method: 'GET', entityType: 'glAccount', entityId: id })
      })
      if (error) return { success: false, error: error.message }
      return { success: true, data: data?.data ?? data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { success: false, error: msg }
    }
  }

  async syncGLAccountToBuildium(glAccount: Record<string, unknown>): Promise<EdgeResult<BuildiumGLAccount>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'glAccount',
          operation: glAccount?.Id ? 'update' : 'create',
          entityData: glAccount,
        })
      });

      if (error) return { success: false, error: error.message };
      if (data?.error) return { success: false, error: data.error };
      return { success: true, data: data?.data ?? data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async syncBankAccountToBuildium(bankAccountData: Record<string, unknown>): Promise<EdgeIdResult> {
    try {
      const existingId =
        bankAccountData?.buildium_gl_account_id ??
        bankAccountData?.buildium_bank_id ??
        bankAccountData?.Id ??
        null

      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          entityType: 'bankAccount',
          entityData: bankAccountData,
          operation: existingId ? 'update' : 'create'
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { 
          success: true, 
          buildiumId: data.data?.Id || existingId || undefined
        }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to sync bank account via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getBankAccountFromBuildium(bankAccountId: number): Promise<EdgeResult<BuildiumBankAccount>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { body: this.withCreds({
          method: 'GET',
          entityType: 'bankAccount',
          entityId: bankAccountId
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      if (data.success) {
        return { success: true, data: data.data }
      } else {
        return { success: false, error: data.error || 'Unknown error' }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get bank account via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getBankAccountSyncStatus(bankAccountId: string): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: {
          method: 'GET',
          entityType: 'bankAccount',
          entityId: bankAccountId
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get bank account sync status via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async getAllBankAccountSyncStatuses(): Promise<EdgeResult<Record<string, unknown>>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-status', {
        body: this.withCreds({
          method: 'GET',
          entityType: 'bankAccount'
        })
      })

      if (error) {
        console.error('Edge function error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to get all bank account sync statuses via edge function:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Property image operations
  /**
   * Upload a property image to Buildium
   * @param propertyId - The Buildium property ID
   * @param imageData - The image data containing FileName, FileData, and Description
   * @returns Promise resolving to the uploaded image result
   */
  async uploadPropertyImage(
    propertyId: string,
    imageData: unknown,
  ): Promise<EdgeResult<BuildiumPropertyImage>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { 
        body: this.withCreds({ 
          entityType: 'property_image', 
          operation: 'upload', 
          propertyId,
          imageData 
        })
      })
      
      if (error) {
        console.error('Property image upload error:', error)
        throw error
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error')
      }

      return { success: true, data: data.data }
    } catch (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const details = await error.context.json()
          const message = details?.error || JSON.stringify(details)
          console.error('Failed to upload property image via edge function', message)
          throw new Error(message || error.message)
        } catch (parseErr) {
          console.error('Failed to parse edge function error response', parseErr)
          throw new Error(error.message)
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to upload property image:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async updatePropertyImage(propertyId: string, imageId: string, imageData: unknown): Promise<EdgeResult<BuildiumPropertyImage>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { 
        body: this.withCreds({ 
          entityType: 'property_image', 
          operation: 'update', 
          propertyId,
          imageId,
          imageData 
        })
      })
      
      if (error) {
        console.error('Property image update error:', error)
        throw new Error(error.message)
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error')
      }

      return { success: true, data: data.data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to update property image:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async deletePropertyImage(propertyId: string, imageId: string): Promise<EdgeResult<void>> {
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { 
        body: this.withCreds({ 
          entityType: 'property_image', 
          operation: 'delete', 
          propertyId,
          imageId
        })
      })
      
      if (error) {
        console.error('Property image delete error:', error)
        return { success: false, error: error.message }
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Unknown error' }
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to delete property image:', errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Generic raw proxy to Edge (keeps secrets at Edge)
  async proxyRaw(method: string, path: string, params?: Record<string, unknown>, payload?: unknown): Promise<EdgeResult>{
    try {
      const { data, error } = await supabase.functions.invoke('buildium-sync', { 
        body: this.withCreds({ 
          entityType: 'raw', 
          operation: 'fetch', 
          method, 
          path,
          params: params || {}, 
          payload 
        })
      })
      if (error) return { success: false, error: error.message }
      if (!data?.success) return { success: false, error: data?.error || 'Unknown error' }
      return { success: true, data: data.data }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }
}

/**
 * Get org-scoped Buildium Edge client
 *
 * BREAKING CHANGE: Now requires orgId parameter (or explicit undefined for system jobs)
 * All credential access flows through getOrgScopedBuildiumConfig (central choke point)
 *
 * @param orgId - Organization ID (undefined for system jobs without org context)
 * @returns Configured BuildiumEdgeClient instance
 */
export async function getOrgScopedBuildiumEdgeClient(
  orgId?: string | undefined,
): Promise<BuildiumEdgeClient> {
  const { getOrgScopedBuildiumConfig } = await import('./buildium/credentials-manager');
  const credentials = await getOrgScopedBuildiumConfig(orgId);

  if (!credentials) {
    throw new Error(
      orgId
        ? `Buildium credentials not available for org ${orgId}`
        : 'Buildium credentials not available (no orgId provided and no env vars)',
    );
  }

  return new BuildiumEdgeClient({
    baseUrl: credentials.baseUrl,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  });
}

/**
 * Export singleton instance
 * 
 * @deprecated Use getOrgScopedBuildiumEdgeClient instead for org-scoped credentials.
 * This singleton falls back to environment variables and should only be used for
 * system jobs without org context.
 */
export const buildiumEdgeClient = new BuildiumEdgeClient()
