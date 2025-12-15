// Sync Error Recovery System
// Detects and recovers from failed sync operations

import type { Json, Database } from '@/types/database'
import type { TypedSupabaseClient } from './db'
import type {
  BuildiumLease,
  BuildiumOwner,
  BuildiumProperty,
  BuildiumTenant,
  BuildiumTenantAddress,
  BuildiumUnit
} from '@/types/buildium'

type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE'
type SyncEntity = 'property' | 'unit' | 'lease' | 'tenant' | 'contact' | 'owner'
type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'
type OperationTableName = 'properties' | 'units' | 'lease' | 'tenants' | 'contacts' | 'owners'
type BuildiumContactPayload = Pick<
  BuildiumTenant,
  'FirstName' | 'LastName' | 'Email' | 'PhoneNumbers' | 'EmergencyContact' | 'Comment' | 'TaxId' | 'SMSOptInStatus'
> & {
  Address?: BuildiumTenantAddress
  PrimaryAddress?: BuildiumTenantAddress
}

type OperationDataMap = {
  property: Partial<BuildiumProperty>
  unit: Partial<BuildiumUnit>
  lease: Partial<BuildiumLease>
  tenant: Partial<BuildiumTenant>
  contact: BuildiumContactPayload
  owner: Partial<BuildiumOwner> & { contact?: BuildiumContactPayload }
}

type SyncOperationRow = Database['public']['Tables']['sync_operations']['Row']
type SyncOperationData = OperationDataMap[SyncEntity]
type SyncOperationByEntity<E extends SyncEntity> = {
  id: string
  type: SyncOperationType
  entity: E
  buildiumId: number
  localId?: string | number
  status: SyncStatus
  data: OperationDataMap[E]
  dependencies?: string[] // IDs of operations this depends on
  error?: string
  attempts: number
  lastAttempt: Date
  createdAt: Date
}

type SyncOperation = {
  [E in SyncEntity]: SyncOperationByEntity<E>
}[SyncEntity]

type ResolverInput = Partial<{
  property: BuildiumProperty
  unit: BuildiumUnit
  lease: BuildiumLease
  tenant: BuildiumTenant
  contact: BuildiumContactPayload
  owner: BuildiumOwner & { contact?: BuildiumContactPayload }
}>
type ResolverResult = {
  propertyId?: string
  unitId?: string
  leaseId?: string
  tenantId?: string
  contactId?: string
  ownerId?: string
  errors: string[]
}

interface RecoveryResult {
  recovered: number
  failed: number
  skipped: number
  errors: string[]
  operations: SyncOperation[]
}

const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export class SyncErrorRecovery {
  private supabase: TypedSupabaseClient
  private maxRetries = 3
  private retryDelay = 5000 // 5 seconds
  private tableMap: Record<SyncEntity, OperationTableName> = {
    property: 'properties',
    unit: 'units',
    lease: 'lease',
    tenant: 'tenants',
    contact: 'contacts',
    owner: 'owners'
  }

  constructor(supabaseClient: TypedSupabaseClient) {
    this.supabase = supabaseClient
  }

  /**
   * Detect failed sync operations
   */
  async detectFailedOperations(): Promise<SyncOperation[]> {
    try {
      // Check for incomplete sync operations
      const { data: failedOps, error } = await this.supabase
        .from('sync_operations')
        .select('*')
        .in('status', ['FAILED', 'IN_PROGRESS'])
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Failed to detect sync operations:', error)
        return []
      }

      // Filter operations that are truly stuck (in progress for > 10 minutes)
      const now = new Date()
      const stuckOps = (failedOps ?? [])
        .map(op => this.mapOperationRowToModel(op as SyncOperationRow))
        .filter(op => {
          if (op.status === 'FAILED') return true
          if (op.status === 'IN_PROGRESS') {
            const minutesSinceLastAttempt = (now.getTime() - op.lastAttempt.getTime()) / (1000 * 60)
            return minutesSinceLastAttempt > 10
          }
          return false
        })

      return stuckOps

    } catch (error) {
      console.error('Error detecting failed operations:', error)
      return []
    }
  }

  /**
   * Recover from failed sync operations
   */
  async recoverFailedOperations(operations?: SyncOperation[]): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      recovered: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      operations: []
    }

    try {
      // Get failed operations if not provided
      const failedOps = operations || await this.detectFailedOperations()
      
      if (failedOps.length === 0) {
        console.log('No failed operations to recover')
        return result
      }

      console.log(`Found ${failedOps.length} failed operations to recover`)

      // Sort operations by dependencies (parents first)
      const sortedOps = this.sortByDependencies(failedOps)

      // Attempt to recover each operation
      for (const operation of sortedOps) {
        try {
          const recoveryResult = await this.recoverSingleOperation(operation)
          
          if (recoveryResult.success) {
            result.recovered++
            operation.status = 'COMPLETED'
          } else {
            result.failed++
            operation.status = 'FAILED'
            operation.error = recoveryResult.error
            result.errors.push(`${operation.entity} ${operation.buildiumId}: ${recoveryResult.error}`)
          }
          
          result.operations.push(operation)
          
          // Update operation status in database
          await this.updateOperationStatus(operation)
          
          // Small delay between operations
          await this.delay(1000)
          
        } catch (error) {
          const message = toErrorMessage(error)
          result.failed++
          result.errors.push(`${operation.entity} ${operation.buildiumId}: ${message}`)
          operation.status = 'FAILED'
          operation.error = message
          await this.updateOperationStatus(operation)
        }
      }

      console.log(`Recovery complete: ${result.recovered} recovered, ${result.failed} failed`)
      return result

    } catch (error) {
      result.errors.push(`Recovery process failed: ${toErrorMessage(error)}`)
      return result
    }
  }

  /**
   * Recover a single sync operation
   */
  private async recoverSingleOperation(operation: SyncOperation): Promise<{ success: boolean; error?: string }> {
    console.log(`Attempting to recover ${operation.entity} ${operation.buildiumId}...`)

    // Check if operation has exceeded retry limit
    if (operation.attempts >= this.maxRetries) {
      return { success: false, error: `Exceeded maximum retry attempts (${this.maxRetries})` }
    }

    // Update attempt count and status
    operation.attempts++
    operation.lastAttempt = new Date()
    operation.status = 'IN_PROGRESS'
    await this.updateOperationStatus(operation)

    try {
      switch (operation.type) {
        case 'CREATE':
          return await this.recoverCreateOperation(operation)
        case 'UPDATE':
          return await this.recoverUpdateOperation(operation)
        case 'DELETE':
          return await this.recoverDeleteOperation(operation)
        default:
          return { success: false, error: `Unknown operation type: ${operation.type}` }
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  }

  /**
   * Recover CREATE operation
   */
  private async recoverCreateOperation(operation: SyncOperation): Promise<{ success: boolean; error?: string }> {
    try {
      // First, check if the record was actually created (maybe the operation succeeded but wasn't marked as complete)
      const existingRecord = await this.findExistingRecord(operation)
      
      if (existingRecord) {
        console.log(`Record already exists for ${operation.entity} ${operation.buildiumId}, marking as complete`)
        operation.localId = String(existingRecord.id)
        return { success: true }
      }

      // Check if dependencies are satisfied
      const dependenciesResult = await this.checkDependencies(operation)
      if (!dependenciesResult.satisfied) {
        return { success: false, error: `Dependencies not satisfied: ${dependenciesResult.missing.join(', ')}` }
      }

      // Attempt to create the record
      const createResult = await this.createRecord(operation)
      if (createResult.success && createResult.localId) {
        operation.localId = createResult.localId
        return { success: true }
      }

      return { success: false, error: createResult.error || 'Create operation failed' }

    } catch (error) {
      return { success: false, error: `Create recovery failed: ${toErrorMessage(error)}` }
    }
  }

  /**
   * Recover UPDATE operation
   */
  private async recoverUpdateOperation(operation: SyncOperation): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the existing record
      const existingRecord = await this.findExistingRecord(operation)
      
      if (!existingRecord) {
        // Record doesn't exist, convert to CREATE operation
        console.log(`Record not found for update, converting to create operation`)
        operation.type = 'CREATE'
        return await this.recoverCreateOperation(operation)
      }

      // Attempt to update the record
      const updateResult = await this.updateRecord(operation, existingRecord.id)
      return updateResult

    } catch (error) {
      return { success: false, error: `Update recovery failed: ${toErrorMessage(error)}` }
    }
  }

  /**
   * Recover DELETE operation
   */
  private async recoverDeleteOperation(operation: SyncOperation): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the existing record
      const existingRecord = await this.findExistingRecord(operation)
      
      if (!existingRecord) {
        // Record doesn't exist, consider delete successful
        console.log(`Record not found for delete, considering successful`)
        return { success: true }
      }

      // Attempt to delete the record
      const deleteResult = await this.deleteRecord(operation, existingRecord.id)
      return deleteResult

    } catch (error) {
      return { success: false, error: `Delete recovery failed: ${toErrorMessage(error)}` }
    }
  }

  /**
   * Find existing record by Buildium ID
   */
  private async findExistingRecord(operation: SyncOperation): Promise<{ id: string | number } | null> {
    const buildiumIdMap: Record<SyncEntity, string> = {
      property: 'buildium_property_id',
      unit: 'buildium_unit_id',
      lease: 'buildium_lease_id',
      tenant: 'buildium_tenant_id',
      contact: 'id', // contacts use direct ID
      owner: 'buildium_owner_id'
    }

    const table = this.tableMap[operation.entity]
    const buildiumField = buildiumIdMap[operation.entity]

    if (!table || !buildiumField) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from(table)
        .select('id')
        .eq(buildiumField as string, operation.buildiumId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error(`Error finding existing record:`, error)
        return null
      }

      return data
    } catch (error) {
      console.error(`Error finding existing record:`, error)
      return null
    }
  }

  /**
   * Check if operation dependencies are satisfied
   */
  private async checkDependencies(operation: SyncOperation): Promise<{ satisfied: boolean; missing: string[] }> {
    if (!operation.dependencies || operation.dependencies.length === 0) {
      return { satisfied: true, missing: [] }
    }

    const missing: string[] = []

    for (const depId of operation.dependencies) {
      const { data: dep, error } = await this.supabase
        .from('sync_operations')
        .select('status')
        .eq('id', depId)
        .single()

      if (error || !dep || dep.status !== 'COMPLETED') {
        missing.push(depId)
      }
    }

    return {
      satisfied: missing.length === 0,
      missing
    }
  }

  /**
   * Create record using the relationship resolver
   */
  private async createRecord(operation: SyncOperation): Promise<{ success: boolean; localId?: string; error?: string }> {
    try {
      // Use the relationship resolver for complex entity creation
      const { RelationshipResolver } = await import('./relationship-resolver')
      const resolver = new RelationshipResolver({ supabase: this.supabase })

      // Map operation data to resolver format
      const buildiumData = this.mapOperationDataForResolver(operation)
      const result = await resolver.resolveEntityChain(buildiumData)

      if (result.errors.length > 0) {
        return { success: false, error: result.errors.join('; ') }
      }

      // Get the appropriate ID based on entity type
      const localId = this.extractLocalIdFromResult(operation.entity, result)
      
      if (localId) {
        return { success: true, localId }
      } else {
        return { success: false, error: 'Failed to extract local ID from result' }
      }

    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  }

  /**
   * Update existing record
   */
  private async updateRecord(operation: SyncOperation, localId: string | number): Promise<{ success: boolean; error?: string }> {
    const table = this.tableMap[operation.entity]
    if (!table) {
      return { success: false, error: `Unknown entity type: ${operation.entity}` }
    }

    try {
      const { error } = await this.supabase
        .from(table)
        .update({
          ...operation.data,
          updated_at: new Date().toISOString()
        })
        .eq('id', localId)

      if (error) {
        return { success: false, error: toErrorMessage(error) }
      }

      return { success: true }

    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  }

  /**
   * Delete record
   */
  private async deleteRecord(operation: SyncOperation, localId: string | number): Promise<{ success: boolean; error?: string }> {
    const table = this.tableMap[operation.entity]
    if (!table) {
      return { success: false, error: `Unknown entity type: ${operation.entity}` }
    }

    try {
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq('id', localId)

      if (error) {
        return { success: false, error: toErrorMessage(error) }
      }

      return { success: true }

    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  }

  /**
   * Sort operations by dependencies (parents first)
   */
  private sortByDependencies(operations: SyncOperation[]): SyncOperation[] {
    const sorted: SyncOperation[] = []
    const remaining = [...operations]
    const processed = new Set<string>()

    while (remaining.length > 0) {
      let foundOne = false
      
      for (let i = remaining.length - 1; i >= 0; i--) {
        const op = remaining[i]
        const canProcess = !op.dependencies || op.dependencies.every(depId => processed.has(depId))
        
        if (canProcess) {
          sorted.push(op)
          processed.add(op.id)
          remaining.splice(i, 1)
          foundOne = true
        }
      }
      
      // If we couldn't process any operation, there might be circular dependencies
      if (!foundOne) {
        console.warn('Possible circular dependencies detected, processing remaining operations anyway')
        sorted.push(...remaining)
        break
      }
    }

    return sorted
  }

  /**
   * Update operation status in database
   */
  private async updateOperationStatus(operation: SyncOperation): Promise<void> {
    try {
      await this.supabase
        .from('sync_operations')
        .update({
          status: operation.status,
          local_id: operation.localId !== undefined ? String(operation.localId) : null,
          error: operation.error,
          attempts: operation.attempts,
          last_attempt: operation.lastAttempt.toISOString()
        })
        .eq('id', operation.id)
    } catch (error) {
      console.error('Failed to update operation status:', error)
    }
  }

  /**
   * Map operation data for relationship resolver
   */
  private mapOperationDataForResolver(operation: SyncOperation): ResolverInput {
    const data = operation.data
    switch (operation.entity) {
      case 'property':
        return { property: data as unknown as BuildiumProperty }
      case 'unit':
        return { unit: data as unknown as BuildiumUnit }
      case 'lease':
        return { lease: data as unknown as BuildiumLease }
      case 'tenant':
        return { tenant: data as unknown as BuildiumTenant }
      case 'contact':
        return { contact: data as BuildiumContactPayload }
      case 'owner':
        return { owner: data as unknown as BuildiumOwner & { contact?: BuildiumContactPayload } }
      default:
        return {}
    }
  }

  /**
   * Extract local ID from resolver result
   */
  private extractLocalIdFromResult(entityType: SyncEntity, result: ResolverResult): string | undefined {
    switch (entityType) {
      case 'property': return result.propertyId
      case 'unit': return result.unitId
      case 'lease': return result.leaseId
      case 'tenant': return result.tenantId
      case 'contact': return result.contactId
      case 'owner': return result.ownerId
      default: return undefined
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Convert a database row to the in-memory model with camelCase fields
   */
  private mapOperationRowToModel(row: SyncOperationRow): SyncOperation {
    const entity = row.entity as SyncEntity
    const data = this.normalizeData(row.data) as OperationDataMap[typeof entity]
    return {
      id: row.id,
      type: row.type as SyncOperationType,
      entity,
      buildiumId: row.buildium_id,
      localId: row.local_id ?? undefined,
      status: row.status as SyncStatus,
      data,
      dependencies: row.dependencies ?? undefined,
      error: row.error ?? undefined,
      attempts: row.attempts,
      lastAttempt: row.last_attempt ? new Date(row.last_attempt) : new Date(0),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0)
    } as SyncOperation
  }

  private normalizeData(data: Json): SyncOperationData {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as OperationDataMap[SyncEntity]
    }
    return {} as OperationDataMap[SyncEntity]
  }
}

/**
 * SQL for sync_operations table (add to migration)
 */
export const SYNC_OPERATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('CREATE', 'UPDATE', 'DELETE')),
  entity VARCHAR(20) NOT NULL CHECK (entity IN ('property', 'unit', 'lease', 'tenant', 'contact', 'owner')),
  buildium_id INTEGER NOT NULL,
  local_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
  data JSONB NOT NULL,
  dependencies TEXT[],
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_sync_operations_entity_buildium_id ON sync_operations(entity, buildium_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_created_at ON sync_operations(created_at);
`;

/**
 * Utility function to run error recovery
 */
export async function runSyncRecovery(supabaseClient: TypedSupabaseClient): Promise<RecoveryResult> {
  const recovery = new SyncErrorRecovery(supabaseClient)
  return await recovery.recoverFailedOperations()
}
