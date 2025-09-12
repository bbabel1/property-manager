// Buildium API Client
// This file contains a comprehensive client for interacting with the Buildium API

import type {
  BuildiumProperty,
  BuildiumPropertyCreate,
  BuildiumPropertyUpdate,
  BuildiumUnit,
  BuildiumUnitCreate,
  BuildiumUnitUpdate,
  BuildiumOwner,
  BuildiumOwnerCreate,
  BuildiumOwnerUpdate,
  BuildiumVendor,
  BuildiumVendorCreate,
  BuildiumVendorUpdate,
  BuildiumTask,
  BuildiumTaskCreate,
  BuildiumTaskUpdate,
  BuildiumBill,
  BuildiumBillCreate,
  BuildiumBillUpdate,
  BuildiumBankAccount,
  BuildiumBankAccountCreate,
  BuildiumBankAccountUpdate,
  BuildiumLease,
  BuildiumLeaseCreate,
  BuildiumLeaseUpdate,
  BuildiumAppliance,
  BuildiumApplianceCreate,
  BuildiumApplianceUpdate,
  BuildiumApplianceServiceHistory,
  BuildiumApplianceServiceHistoryCreate,
  BuildiumApplianceServiceHistoryUpdate,
  BuildiumGLAccount,
  BuildiumGLEntry,
  BuildiumGLTransaction,
  BuildiumGLAccountBalance,
  BuildiumWorkOrder,
  BuildiumWorkOrderCreate,
  BuildiumWorkOrderUpdate,
  BuildiumApiResponse,
  BuildiumApiError,
  BuildiumApiConfig,
  BuildiumWebhookEvent,
  BuildiumWebhookPayload
} from '@/types/buildium'

import {
  BuildiumSchemas,
  type BuildiumPropertyCreateEnhancedInput,
  type BuildiumUnitCreateEnhancedInput,
  type BuildiumOwnerCreateEnhancedInput,
  type BuildiumVendorCreateEnhancedInput,
  type BuildiumTaskCreateEnhancedInput,
  type BuildiumBillCreateEnhancedInput,
  type BuildiumBankAccountCreateEnhancedInput,
  type BuildiumLeaseCreateEnhancedInput
} from '@/schemas/buildium'

import {
  mapPropertyToBuildium,
  mapUnitToBuildium,
  mapUnitFromBuildium,
  mapOwnerToBuildium,
  mapOwnerFromBuildium,
  mapVendorToBuildium,
  mapVendorFromBuildium,
  mapTaskToBuildium,
  mapTaskFromBuildium,
  mapBillToBuildium,
  mapBillFromBuildium,
  mapBankAccountToBuildium,
  mapLeaseToBuildium,
  mapLeaseFromBuildium,
  mapGLAccountToBuildium,
  sanitizeForBuildium,
  validateBuildiumResponse,
  extractBuildiumId
} from './buildium-mappers'

export class BuildiumClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(config: BuildiumApiConfig) {
    this.baseUrl = config.baseUrl
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.timeout = config.timeout || 30000
    this.retryAttempts = config.retryAttempts || 3
    this.retryDelay = config.retryDelay || 1000
  }

  // ============================================================================
  // PROPERTY METHODS
  // ============================================================================

  async getProperties(params?: {
    pageSize?: number
    pageNumber?: number
    propertyType?: string
    isActive?: boolean
  }): Promise<BuildiumApiResponse<BuildiumProperty>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.propertyType) queryParams.append('propertyType', params.propertyType)
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumProperty>>(
      `GET`,
      `/properties?${queryParams.toString()}`
    )
  }

  async getProperty(id: number): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>(`GET`, `/properties/${id}`)
  }

  async createProperty(data: BuildiumPropertyCreateEnhancedInput): Promise<BuildiumProperty> {
    const buildiumData = mapPropertyToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumProperty>(`POST`, `/properties`, sanitizedData)
  }

  async updateProperty(id: number, data: Partial<BuildiumPropertyCreateEnhancedInput>): Promise<BuildiumProperty> {
    const buildiumData = mapPropertyToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumProperty>(`PUT`, `/properties/${id}`, sanitizedData)
  }

  async deleteProperty(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/properties/${id}`)
  }

  // ============================================================================
  // UNIT METHODS
  // ============================================================================

  async getUnits(propertyId: number, params?: {
    pageSize?: number
    pageNumber?: number
    isActive?: boolean
  }): Promise<BuildiumApiResponse<BuildiumUnit>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumUnit>>(
      `GET`,
      `/properties/${propertyId}/units?${queryParams.toString()}`
    )
  }

  async getUnit(propertyId: number, unitId: number): Promise<BuildiumUnit> {
    return this.makeRequest<BuildiumUnit>(`GET`, `/properties/${propertyId}/units/${unitId}`)
  }

  async createUnit(propertyId: number, data: BuildiumUnitCreateEnhancedInput): Promise<BuildiumUnit> {
    const buildiumData = mapUnitToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumUnit>(`POST`, `/properties/${propertyId}/units`, sanitizedData)
  }

  async updateUnit(propertyId: number, unitId: number, data: Partial<BuildiumUnitCreateEnhancedInput>): Promise<BuildiumUnit> {
    const buildiumData = mapUnitToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumUnit>(`PUT`, `/properties/${propertyId}/units/${unitId}`, sanitizedData)
  }

  async deleteUnit(propertyId: number, unitId: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/properties/${propertyId}/units/${unitId}`)
  }

  // ============================================================================
  // OWNER METHODS
  // ============================================================================

  async getOwners(params?: {
    pageSize?: number
    pageNumber?: number
    isActive?: boolean
  }): Promise<BuildiumApiResponse<BuildiumOwner>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumOwner>>(
      `GET`,
      `/owners?${queryParams.toString()}`
    )
  }

  async getOwner(id: number): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>(`GET`, `/owners/${id}`)
  }

  async createOwner(data: BuildiumOwnerCreateEnhancedInput): Promise<BuildiumOwner> {
    const buildiumData = mapOwnerToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumOwner>(`POST`, `/owners`, sanitizedData)
  }

  async updateOwner(id: number, data: Partial<BuildiumOwnerCreateEnhancedInput>): Promise<BuildiumOwner> {
    const buildiumData = mapOwnerToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumOwner>(`PUT`, `/owners/${id}`, sanitizedData)
  }

  async deleteOwner(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/owners/${id}`)
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(params?: {
    pageSize?: number
    pageNumber?: number
    isActive?: boolean
  }): Promise<BuildiumApiResponse<BuildiumVendor>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumVendor>>(
      `GET`,
      `/vendors?${queryParams.toString()}`
    )
  }

  async getVendor(id: number): Promise<BuildiumVendor> {
    return this.makeRequest<BuildiumVendor>(`GET`, `/vendors/${id}`)
  }

  async createVendor(data: BuildiumVendorCreateEnhancedInput): Promise<BuildiumVendor> {
    const buildiumData = mapVendorToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumVendor>(`POST`, `/vendors`, sanitizedData)
  }

  async updateVendor(id: number, data: Partial<BuildiumVendorCreateEnhancedInput>): Promise<BuildiumVendor> {
    const buildiumData = mapVendorToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumVendor>(`PUT`, `/vendors/${id}`, sanitizedData)
  }

  async deleteVendor(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/vendors/${id}`)
  }

  // ============================================================================
  // TASK METHODS
  // ============================================================================

  async getTasks(params?: {
    pageSize?: number
    pageNumber?: number
    status?: string
    priority?: string
  }): Promise<BuildiumApiResponse<BuildiumTask>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.priority) queryParams.append('priority', params.priority)

    return this.makeRequest<BuildiumApiResponse<BuildiumTask>>(
      `GET`,
      `/tasks?${queryParams.toString()}`
    )
  }

  async getTask(id: number): Promise<BuildiumTask> {
    return this.makeRequest<BuildiumTask>(`GET`, `/tasks/${id}`)
  }

  async createTask(data: BuildiumTaskCreateEnhancedInput): Promise<BuildiumTask> {
    const buildiumData = mapTaskToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumTask>(`POST`, `/tasks`, sanitizedData)
  }

  async updateTask(id: number, data: Partial<BuildiumTaskCreateEnhancedInput>): Promise<BuildiumTask> {
    const buildiumData = mapTaskToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumTask>(`PUT`, `/tasks/${id}`, sanitizedData)
  }

  async deleteTask(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/tasks/${id}`)
  }

  // ============================================================================
  // BILL METHODS
  // ============================================================================

  async getBills(params?: {
    pageSize?: number
    pageNumber?: number
    status?: string
    vendorId?: number
  }): Promise<BuildiumApiResponse<BuildiumBill>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.vendorId) queryParams.append('vendorId', params.vendorId.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumBill>>(
      `GET`,
      `/bills?${queryParams.toString()}`
    )
  }

  // ============================================================================
  // GENERAL LEDGER METHODS
  // ============================================================================

  async getGLAccounts(params?: { type?: string; subType?: string; isActive?: boolean; limit?: number; offset?: number }): Promise<BuildiumGLAccount[]> {
    const qp = new URLSearchParams()
    if (params?.type) qp.append('type', params.type)
    if (params?.subType) qp.append('subType', params.subType)
    if (params?.isActive !== undefined) qp.append('isActive', String(params.isActive))
    if (params?.limit) qp.append('limit', String(params.limit))
    if (params?.offset) qp.append('offset', String(params.offset))
    return this.makeRequest<BuildiumGLAccount[]>(`GET`, `/glaccounts?${qp.toString()}`)
  }

  async getGLAccount(id: number): Promise<BuildiumGLAccount> {
    return this.makeRequest<BuildiumGLAccount>(`GET`, `/glaccounts/${id}`)
  }

  async createGLAccount(local: any): Promise<BuildiumGLAccount> {
    const payload = sanitizeForBuildium(mapGLAccountToBuildium(local))
    return this.makeRequest<BuildiumGLAccount>(`POST`, `/glaccounts`, payload)
  }

  async updateGLAccount(id: number, local: any): Promise<BuildiumGLAccount> {
    const payload = sanitizeForBuildium(mapGLAccountToBuildium(local))
    return this.makeRequest<BuildiumGLAccount>(`PUT`, `/glaccounts/${id}`, payload)
  }

  async getGLEntries(params?: { glAccountId?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }): Promise<BuildiumGLEntry[]> {
    const qp = new URLSearchParams()
    if (params?.glAccountId) qp.append('glAccountId', String(params.glAccountId))
    if (params?.dateFrom) qp.append('dateFrom', params.dateFrom)
    if (params?.dateTo) qp.append('dateTo', params.dateTo)
    if (params?.limit) qp.append('limit', String(params.limit))
    if (params?.offset) qp.append('offset', String(params.offset))
    return this.makeRequest<BuildiumGLEntry[]>(`GET`, `/glentries?${qp.toString()}`)
  }

  async getGLEntry(id: number): Promise<BuildiumGLEntry> {
    return this.makeRequest<BuildiumGLEntry>(`GET`, `/glentries/${id}`)
  }

  async createGLEntry(data: any): Promise<BuildiumGLEntry> {
    // Assume caller passes GL-ready payload matching schema
    const payload = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumGLEntry>(`POST`, `/glentries`, payload)
  }

  async updateGLEntry(id: number, data: any): Promise<BuildiumGLEntry> {
    const payload = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumGLEntry>(`PUT`, `/glentries/${id}`, payload)
  }

  async getGLTransactions(params?: { glAccountId?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }): Promise<BuildiumGLTransaction[]> {
    const qp = new URLSearchParams()
    if (params?.glAccountId) qp.append('glAccountId', String(params.glAccountId))
    if (params?.dateFrom) qp.append('dateFrom', params.dateFrom)
    if (params?.dateTo) qp.append('dateTo', params.dateTo)
    if (params?.limit) qp.append('limit', String(params.limit))
    if (params?.offset) qp.append('offset', String(params.offset))
    return this.makeRequest<BuildiumGLTransaction[]>(`GET`, `/gltransactions?${qp.toString()}`)
  }

  async getGLAccountBalance(glAccountId: number, asOfDate?: string): Promise<BuildiumGLAccountBalance> {
    const qp = new URLSearchParams()
    if (asOfDate) qp.append('asOfDate', asOfDate)
    return this.makeRequest<BuildiumGLAccountBalance>(`GET`, `/glaccounts/${glAccountId}/balances?${qp.toString()}`)
  }

  async getBill(id: number): Promise<BuildiumBill> {
    return this.makeRequest<BuildiumBill>(`GET`, `/bills/${id}`)
  }

  async createBill(data: BuildiumBillCreateEnhancedInput): Promise<BuildiumBill> {
    const buildiumData = mapBillToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumBill>(`POST`, `/bills`, sanitizedData)
  }

  async updateBill(id: number, data: Partial<BuildiumBillCreateEnhancedInput>): Promise<BuildiumBill> {
    const buildiumData = mapBillToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumBill>(`PUT`, `/bills/${id}`, sanitizedData)
  }

  async deleteBill(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/bills/${id}`)
  }

  // ============================================================================
  // BANK ACCOUNT METHODS
  // ============================================================================

  async getBankAccounts(params?: {
    pageSize?: number
    pageNumber?: number
    isActive?: boolean
  }): Promise<BuildiumApiResponse<BuildiumBankAccount>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumBankAccount>>(
      `GET`,
      `/bankaccounts?${queryParams.toString()}`
    )
  }

  async getBankAccount(id: number): Promise<BuildiumBankAccount> {
    return this.makeRequest<BuildiumBankAccount>(`GET`, `/bankaccounts/${id}`)
  }

  async createBankAccount(data: BuildiumBankAccountCreateEnhancedInput): Promise<BuildiumBankAccount> {
    const buildiumData = mapBankAccountToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumBankAccount>(`POST`, `/bankaccounts`, sanitizedData)
  }

  async updateBankAccount(id: number, data: Partial<BuildiumBankAccountCreateEnhancedInput>): Promise<BuildiumBankAccount> {
    const buildiumData = mapBankAccountToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumBankAccount>(`PUT`, `/bankaccounts/${id}`, sanitizedData)
  }

  async deleteBankAccount(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/bankaccounts/${id}`)
  }

  // ============================================================================
  // LEASE METHODS
  // ============================================================================

  async getLeases(params?: {
    pageSize?: number
    pageNumber?: number
    status?: string
    propertyId?: number
  }): Promise<BuildiumApiResponse<BuildiumLease>> {
    const queryParams = new URLSearchParams()
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId.toString())

    return this.makeRequest<BuildiumApiResponse<BuildiumLease>>(
      `GET`,
      `/leases?${queryParams.toString()}`
    )
  }

  async getLease(id: number): Promise<BuildiumLease> {
    return this.makeRequest<BuildiumLease>(`GET`, `/leases/${id}`)
  }

  async createLease(data: BuildiumLeaseCreateEnhancedInput): Promise<BuildiumLease> {
    const buildiumData = mapLeaseToBuildium(data)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumLease>(`POST`, `/leases`, sanitizedData)
  }

  async updateLease(id: number, data: Partial<BuildiumLeaseCreateEnhancedInput>): Promise<BuildiumLease> {
    const buildiumData = mapLeaseToBuildium(data as any)
    const sanitizedData = sanitizeForBuildium(buildiumData)
    
    return this.makeRequest<BuildiumLease>(`PUT`, `/leases/${id}`, sanitizedData)
  }

  async deleteLease(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/leases/${id}`)
  }

  // ============================================================================
  // WORK ORDER METHODS
  // ============================================================================

  async getWorkOrders(params?: {
    propertyId?: number
    unitId?: number
    status?: string
    categoryId?: number
    limit?: number
    offset?: number
  }): Promise<BuildiumWorkOrder[]> {
    const queryParams = new URLSearchParams()
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId.toString())
    if (params?.unitId) queryParams.append('unitId', params.unitId.toString())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.categoryId) queryParams.append('categoryId', params.categoryId.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    // Buildium returns an array for /workorders
    const result = await this.makeRequest<any>(`GET`, `/workorders?${queryParams.toString()}`)
    // Some environments might wrap or not; normalize to array
    const data = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : []
    return data as BuildiumWorkOrder[]
  }

  async getWorkOrder(id: number): Promise<BuildiumWorkOrder> {
    return this.makeRequest<BuildiumWorkOrder>(`GET`, `/workorders/${id}`)
  }

  async createWorkOrder(data: BuildiumWorkOrderCreate): Promise<BuildiumWorkOrder> {
    const sanitizedData = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumWorkOrder>(`POST`, `/workorders`, sanitizedData)
  }

  async updateWorkOrder(id: number, data: BuildiumWorkOrderUpdate): Promise<BuildiumWorkOrder> {
    const sanitizedData = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumWorkOrder>(`PUT`, `/workorders/${id}`, sanitizedData)
  }

  // ============================================================================
  // APPLIANCE METHODS (Rental Appliances)
  // ============================================================================

  async getAppliances(params?: {
    propertyId?: number
    unitId?: number
    applianceType?: string
    limit?: number
    offset?: number
  }): Promise<BuildiumAppliance[]> {
    const queryParams = new URLSearchParams()
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId.toString())
    if (params?.unitId) queryParams.append('unitId', params.unitId.toString())
    if (params?.applianceType) queryParams.append('applianceType', params.applianceType)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    return this.makeRequest<BuildiumAppliance[]>(`GET`, `/rentals/appliances?${queryParams.toString()}`)
  }

  async getAppliance(id: number): Promise<BuildiumAppliance> {
    return this.makeRequest<BuildiumAppliance>(`GET`, `/rentals/appliances/${id}`)
  }

  async createAppliance(data: BuildiumApplianceCreate): Promise<BuildiumAppliance> {
    const sanitizedData = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumAppliance>(`POST`, `/rentals/appliances`, sanitizedData)
  }

  async updateAppliance(id: number, data: BuildiumApplianceUpdate): Promise<BuildiumAppliance> {
    const sanitizedData = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumAppliance>(`PUT`, `/rentals/appliances/${id}`, sanitizedData)
  }

  async deleteAppliance(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/rentals/appliances/${id}`)
  }

  async listApplianceServiceHistory(applianceId: number, params?: { limit?: number; offset?: number }): Promise<BuildiumApplianceServiceHistory[]> {
    const qp = new URLSearchParams()
    if (params?.limit) qp.append('limit', String(params.limit))
    if (params?.offset) qp.append('offset', String(params.offset))
    return this.makeRequest<BuildiumApplianceServiceHistory[]>(`GET`, `/rentals/appliances/${applianceId}/servicehistory?${qp.toString()}`)
  }

  async getApplianceServiceHistory(applianceId: number, serviceHistoryId: number): Promise<BuildiumApplianceServiceHistory> {
    return this.makeRequest<BuildiumApplianceServiceHistory>(`GET`, `/rentals/appliances/${applianceId}/servicehistory/${serviceHistoryId}`)
  }

  async createApplianceServiceHistory(applianceId: number, data: BuildiumApplianceServiceHistoryCreate): Promise<BuildiumApplianceServiceHistory> {
    const sanitized = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumApplianceServiceHistory>(`POST`, `/rentals/appliances/${applianceId}/servicehistory`, sanitized)
  }

  async updateApplianceServiceHistory(applianceId: number, serviceHistoryId: number, data: BuildiumApplianceServiceHistoryUpdate): Promise<BuildiumApplianceServiceHistory> {
    const sanitized = sanitizeForBuildium(data)
    return this.makeRequest<BuildiumApplianceServiceHistory>(`PUT`, `/rentals/appliances/${applianceId}/servicehistory/${serviceHistoryId}`, sanitized)
  }

  // ============================================================================
  // WEBHOOK METHODS
  // ============================================================================

  async processWebhook(payload: BuildiumWebhookPayload): Promise<void> {
    // Process webhook events
    for (const event of payload.Events) {
      await this.processWebhookEvent(event)
    }
  }

  private async processWebhookEvent(event: BuildiumWebhookEvent): Promise<void> {
    // This would be implemented based on your webhook processing logic
    console.log(`Processing webhook event: ${event.EventType} for entity ${event.EntityId}`)
    
    // You would typically:
    // 1. Validate the webhook signature
    // 2. Process the event based on type
    // 3. Update local database
    // 4. Log the event
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-buildium-client-id': this.clientId,
      'x-buildium-client-secret': this.clientSecret,
    }

    const config: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout)
    }

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data)
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorData.Message || 'Unknown error'}`)
        }

        const result = await response.json()
        
        if (!validateBuildiumResponse(result)) {
          throw new Error('Invalid response from Buildium API')
        }

        return result as T
      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)))
          continue
        }
        
        throw lastError
      }
    }

    throw lastError || new Error('Request failed after all retry attempts')
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async batchCreateProperties(properties: BuildiumPropertyCreateEnhancedInput[]): Promise<BuildiumProperty[]> {
    const results: BuildiumProperty[] = []
    
    for (const property of properties) {
      try {
        const result = await this.createProperty(property)
        results.push(result)
      } catch (error) {
        console.error(`Failed to create property: ${error}`)
        throw error
      }
    }
    
    return results
  }

  async batchCreateUnits(propertyId: number, units: BuildiumUnitCreateEnhancedInput[]): Promise<BuildiumUnit[]> {
    const results: BuildiumUnit[] = []
    
    for (const unit of units) {
      try {
        const result = await this.createUnit(propertyId, unit)
        results.push(result)
      } catch (error) {
        console.error(`Failed to create unit: ${error}`)
        throw error
      }
    }
    
    return results
  }

  // ============================================================================
  // SYNC HELPERS
  // ============================================================================

  async syncPropertyToBuildium(localProperty: any): Promise<number | null> {
    try {
      if (localProperty.buildium_property_id) {
        // Update existing property
        await this.updateProperty(localProperty.buildium_property_id, localProperty)
        return localProperty.buildium_property_id
      } else {
        // Create new property
        const buildiumProperty = await this.createProperty(localProperty)
        return buildiumProperty.Id
      }
    } catch (error) {
      console.error(`Failed to sync property to Buildium: ${error}`)
      throw error
    }
  }

  async syncUnitToBuildium(propertyId: number, localUnit: any): Promise<number | null> {
    try {
      if (localUnit.buildium_unit_id) {
        // Update existing unit
        await this.updateUnit(propertyId, localUnit.buildium_unit_id, localUnit)
        return localUnit.buildium_unit_id
      } else {
        // Create new unit
        const buildiumUnit = await this.createUnit(propertyId, localUnit)
        return buildiumUnit.Id
      }
    } catch (error) {
      console.error(`Failed to sync unit to Buildium: ${error}`)
      throw error
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createBuildiumClient(config: BuildiumApiConfig): BuildiumClient {
  return new BuildiumClient(config)
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const defaultBuildiumConfig: BuildiumApiConfig = {
  baseUrl: process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1',
  clientId: process.env.BUILDIUM_CLIENT_ID || '',
  clientSecret: process.env.BUILDIUM_CLIENT_SECRET || '',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
}
