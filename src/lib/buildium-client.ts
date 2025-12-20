/* eslint-disable @typescript-eslint/ban-ts-comment */
// Buildium API Client
// This file contains a comprehensive client for interacting with the Buildium API

/* eslint-disable @typescript-eslint/no-unused-vars */
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
  BuildiumGeneralJournalEntryInput,
  BuildiumGLTransaction,
  BuildiumGLAccountBalance,
  BuildiumWorkOrder,
  BuildiumWorkOrderCreate,
  BuildiumWorkOrderUpdate,
  BuildiumFileShareSettingsUpdate,
  BuildiumFile,
  BuildiumFileCategory,
  BuildiumApiResponse,
  BuildiumApiError,
  BuildiumApiConfig,
  BuildiumWebhookEvent,
  BuildiumWebhookPayload,
} from '@/types/buildium';

import {
  BuildiumSchemas,
  type BuildiumPropertyCreateEnhancedInput,
  type BuildiumUnitCreateEnhancedInput,
  type BuildiumOwnerCreateEnhancedInput,
  type BuildiumVendorCreateEnhancedInput,
  type BuildiumTaskCreateEnhancedInput,
  type BuildiumBillCreateEnhancedInput,
  type BuildiumBankAccountCreateEnhancedInput,
  type BuildiumLeaseCreateEnhancedInput,
} from '@/schemas/buildium';

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
  extractBuildiumId,
} from './buildium-mappers';
/* eslint-enable @typescript-eslint/no-unused-vars */

export class BuildiumClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: BuildiumApiConfig) {
    this.baseUrl = config.baseUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  // ============================================================================
  // PROPERTY METHODS
  // ============================================================================

  async getProperties(params?: {
    pageSize?: number;
    pageNumber?: number;
    propertyType?: string;
    isActive?: boolean;
  }): Promise<BuildiumApiResponse<BuildiumProperty>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.propertyType) queryParams.append('propertyType', params.propertyType);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    return this.makeRequest<BuildiumApiResponse<BuildiumProperty>>(
      `GET`,
      `/properties?${queryParams.toString()}`,
    );
  }

  async getProperty(id: number): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>(`GET`, `/properties/${id}`);
  }

  async createProperty(data: BuildiumPropertyCreateEnhancedInput): Promise<BuildiumProperty> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumProperty>(`POST`, `/properties`, sanitizedData);
  }

  async updateProperty(
    id: number,
    data: Partial<BuildiumPropertyCreateEnhancedInput>,
  ): Promise<BuildiumProperty> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumProperty>(`PUT`, `/properties/${id}`, sanitizedData);
  }

  async deleteProperty(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/properties/${id}`);
  }

  // ============================================================================
  // UNIT METHODS
  // ============================================================================

  async getUnits(
    propertyId: number,
    params?: {
      pageSize?: number;
      pageNumber?: number;
      isActive?: boolean;
    },
  ): Promise<BuildiumApiResponse<BuildiumUnit>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    if (queryParams.toString()) {
      return this.makeRequest<BuildiumApiResponse<BuildiumUnit>>(
        `GET`,
        `/rentals/units?${queryParams.toString()}`,
      );
    }

    return this.makeRequest<BuildiumApiResponse<BuildiumUnit>>(`GET`, `/rentals/units`);
  }

  async getUnit(propertyId: number, unitId: number): Promise<BuildiumUnit> {
    void propertyId;
    return this.makeRequest<BuildiumUnit>(`GET`, `/rentals/units/${unitId}`);
  }

  async createUnit(
    propertyId: number,
    data: BuildiumUnitCreateEnhancedInput,
  ): Promise<BuildiumUnit> {
    const sanitizedData = sanitizeForBuildium(data);
    void propertyId;
    return this.makeRequest<BuildiumUnit>(`POST`, `/rentals/units`, sanitizedData);
  }

  async updateUnit(
    propertyId: number,
    unitId: number,
    data: Partial<BuildiumUnitCreateEnhancedInput>,
  ): Promise<BuildiumUnit> {
    const sanitizedData = sanitizeForBuildium(data);
    void propertyId;
    return this.makeRequest<BuildiumUnit>(`PUT`, `/rentals/units/${unitId}`, sanitizedData);
  }

  async deleteUnit(propertyId: number, unitId: number): Promise<void> {
    void propertyId;
    return this.makeRequest<void>(`DELETE`, `/rentals/units/${unitId}`);
  }

  // ============================================================================
  // OWNER METHODS
  // ============================================================================

  async getOwners(params?: {
    pageSize?: number;
    pageNumber?: number;
    isActive?: boolean;
  }): Promise<BuildiumApiResponse<BuildiumOwner>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    return this.makeRequest<BuildiumApiResponse<BuildiumOwner>>(
      `GET`,
      `/owners?${queryParams.toString()}`,
    );
  }

  async getOwner(id: number): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>(`GET`, `/owners/${id}`);
  }

  async createOwner(data: BuildiumOwnerCreateEnhancedInput): Promise<BuildiumOwner> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumOwner>(`POST`, `/owners`, sanitizedData);
  }

  async updateOwner(
    id: number,
    data: Partial<BuildiumOwnerCreateEnhancedInput>,
  ): Promise<BuildiumOwner> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumOwner>(`PUT`, `/owners/${id}`, sanitizedData);
  }

  async deleteOwner(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/owners/${id}`);
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async getVendors(params?: {
    pageSize?: number;
    pageNumber?: number;
    isActive?: boolean;
  }): Promise<BuildiumApiResponse<BuildiumVendor>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    return this.makeRequest<BuildiumApiResponse<BuildiumVendor>>(
      `GET`,
      `/vendors?${queryParams.toString()}`,
    );
  }

  async getVendor(id: number): Promise<BuildiumVendor> {
    return this.makeRequest<BuildiumVendor>(`GET`, `/vendors/${id}`);
  }

  async createVendor(data: BuildiumVendorCreateEnhancedInput): Promise<BuildiumVendor> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumVendor>(`POST`, `/vendors`, sanitizedData);
  }

  async updateVendor(
    id: number,
    data: Partial<BuildiumVendorCreateEnhancedInput>,
  ): Promise<BuildiumVendor> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumVendor>(`PUT`, `/vendors/${id}`, sanitizedData);
  }

  async deleteVendor(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/vendors/${id}`);
  }

  // ============================================================================
  // TASK METHODS
  // ============================================================================

  async getTasks(params?: {
    pageSize?: number;
    pageNumber?: number;
    status?: string;
    priority?: string;
  }): Promise<BuildiumApiResponse<BuildiumTask>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);

    return this.makeRequest<BuildiumApiResponse<BuildiumTask>>(
      `GET`,
      `/tasks?${queryParams.toString()}`,
    );
  }

  async getTask(id: number): Promise<BuildiumTask> {
    return this.makeRequest<BuildiumTask>(`GET`, `/tasks/${id}`);
  }

  async createTask(data: BuildiumTaskCreateEnhancedInput): Promise<BuildiumTask> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumTask>(`POST`, `/tasks`, sanitizedData);
  }

  async updateTask(
    id: number,
    data: Partial<BuildiumTaskCreateEnhancedInput>,
  ): Promise<BuildiumTask> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumTask>(`PUT`, `/tasks/${id}`, sanitizedData);
  }

  async deleteTask(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/tasks/${id}`);
  }

  // ============================================================================
  // BILL METHODS
  // ============================================================================

  async getBills(params?: {
    pageSize?: number;
    pageNumber?: number;
    status?: string;
    vendorId?: number;
  }): Promise<BuildiumApiResponse<BuildiumBill>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.vendorId) queryParams.append('vendorId', params.vendorId.toString());

    return this.makeRequest<BuildiumApiResponse<BuildiumBill>>(
      `GET`,
      `/bills?${queryParams.toString()}`,
    );
  }

  // ============================================================================
  // GENERAL LEDGER METHODS
  // ============================================================================

  async getGLAccounts(params?: {
    type?: string;
    subType?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<BuildiumGLAccount[]> {
    const qp = new URLSearchParams();
    if (params?.type) qp.append('type', params.type);
    if (params?.subType) qp.append('subType', params.subType);
    if (params?.isActive !== undefined) qp.append('isActive', String(params.isActive));
    if (params?.limit) qp.append('limit', String(params.limit));
    if (params?.offset) qp.append('offset', String(params.offset));
    return this.makeRequest<BuildiumGLAccount[]>(`GET`, `/glaccounts?${qp.toString()}`);
  }

  async getGLAccount(id: number): Promise<BuildiumGLAccount> {
    return this.makeRequest<BuildiumGLAccount>(`GET`, `/glaccounts/${id}`);
  }

  async createGLAccount(local: Record<string, unknown>): Promise<BuildiumGLAccount> {
    const payload = sanitizeForBuildium(mapGLAccountToBuildium(local as any));
    return this.makeRequest<BuildiumGLAccount>(`POST`, `/glaccounts`, payload);
  }

  async updateGLAccount(id: number, local: Record<string, unknown>): Promise<BuildiumGLAccount> {
    const payload = sanitizeForBuildium(mapGLAccountToBuildium(local as any));
    return this.makeRequest<BuildiumGLAccount>(`PUT`, `/glaccounts/${id}`, payload);
  }

  async getGLEntries(params?: {
    glAccountId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<BuildiumGLEntry[]> {
    const qp = new URLSearchParams();
    if (params?.glAccountId) qp.append('glAccountId', String(params.glAccountId));
    if (params?.dateFrom) qp.append('dateFrom', params.dateFrom);
    if (params?.dateTo) qp.append('dateTo', params.dateTo);
    if (params?.limit) qp.append('limit', String(params.limit));
    if (params?.offset) qp.append('offset', String(params.offset));
    const suffix = qp.toString() ? `?${qp.toString()}` : '';
    return this.makeRequest<BuildiumGLEntry[]>(`GET`, `/generalledger/journalentries${suffix}`);
  }

  async getGLEntry(id: number): Promise<BuildiumGLEntry> {
    return this.makeRequest<BuildiumGLEntry>(`GET`, `/generalledger/journalentries/${id}`);
  }

  async createGLEntry(data: Record<string, unknown>): Promise<BuildiumGLEntry> {
    // Assume caller passes GL-ready payload matching schema
    const payload = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumGLEntry>(`POST`, `/generalledger/journalentries`, payload);
  }

  async updateGLEntry(id: number, data: Record<string, unknown>): Promise<BuildiumGLEntry> {
    const payload = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumGLEntry>(`PUT`, `/generalledger/journalentries/${id}`, payload);
  }

  async createGeneralJournalEntry(
    data: BuildiumGeneralJournalEntryInput,
  ): Promise<BuildiumGLEntry> {
    const payload = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumGLEntry>(`POST`, `/generalledger/journalentries`, payload);
  }

  async updateGeneralJournalEntry(
    id: number,
    data: BuildiumGeneralJournalEntryInput,
  ): Promise<BuildiumGLEntry> {
    const payload = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumGLEntry>(`PUT`, `/generalledger/journalentries/${id}`, payload);
  }

  async getGLTransactions(params?: {
    glAccountId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<BuildiumGLTransaction[]> {
    const qp = new URLSearchParams();
    if (params?.glAccountId) qp.append('glAccountId', String(params.glAccountId));
    if (params?.dateFrom) qp.append('dateFrom', params.dateFrom);
    if (params?.dateTo) qp.append('dateTo', params.dateTo);
    if (params?.limit) qp.append('limit', String(params.limit));
    if (params?.offset) qp.append('offset', String(params.offset));
    return this.makeRequest<BuildiumGLTransaction[]>(`GET`, `/gltransactions?${qp.toString()}`);
  }

  async getGLAccountBalance(
    glAccountId: number,
    asOfDate?: string,
  ): Promise<BuildiumGLAccountBalance> {
    const qp = new URLSearchParams();
    if (asOfDate) qp.append('asOfDate', asOfDate);
    return this.makeRequest<BuildiumGLAccountBalance>(
      `GET`,
      `/glaccounts/${glAccountId}/balances?${qp.toString()}`,
    );
  }

  async getBill(id: number): Promise<BuildiumBill> {
    return this.makeRequest<BuildiumBill>(`GET`, `/bills/${id}`);
  }

  async createBill(data: BuildiumBillCreateEnhancedInput): Promise<BuildiumBill> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumBill>(`POST`, `/bills`, sanitizedData);
  }

  async getBillFiles(billId: number): Promise<BuildiumFile[]> {
    return this.makeRequest<BuildiumFile[]>(`GET`, `/bills/${billId}/files`);
  }

  async createBillFileUploadRequest(
    billId: number,
    data: {
      FileName: string;
      ContentType: string;
      Description?: string | null;
      UnitId?: number | null;
      OwnerId?: number | null;
      IsPrivate?: boolean | null;
      PropertyId?: number | null;
      FileTitle?: string | null;
    },
  ): Promise<unknown> {
    const sanitizedData = sanitizeForBuildium(data);
    try {
      return await this.makeRequest<unknown>(
        `POST`,
        `/bills/${billId}/files/uploadRequests`,
        sanitizedData,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return this.makeRequest<unknown>(
          `POST`,
          `/bills/${billId}/files/uploadrequests`,
          sanitizedData,
        );
      }
      throw error;
    }
  }

  async getLeaseDocuments(leaseId: number): Promise<BuildiumFile[]> {
    const prefixes = [`/leases/${leaseId}`];
    const endpoints = prefixes.flatMap((prefix) => [`${prefix}/files`, `${prefix}/documents`]);
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        return await this.makeRequest<BuildiumFile[]>(`GET`, endpoint);
      } catch (error) {
        const is404 =
          error instanceof Error &&
          (error.message.includes('404') ||
            error.message.includes('Not Found') ||
            error.message.toLowerCase().includes('case sensitive'));
        if (is404) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new Error('Unable to load lease documents');
  }

  async createFileUploadRequest(
    entityType: string,
    entityId: number | string,
    data: {
      FileName: string;
      Title?: string | null;
      Description?: string | null;
      CategoryId?: number | null;
      Category?: string | null;
      ContentType?: string | null;
    },
  ): Promise<BuildiumFileCategory[]> {
    const payload = {
      ...data,
      EntityType: entityType,
      EntityId: entityId,
    };
    const sanitizedData = sanitizeForBuildium(payload);
    try {
      return await this.makeRequest<BuildiumFileCategory[]>(
        `POST`,
        `/files/uploadRequests`,
        sanitizedData,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return this.makeRequest<BuildiumFileCategory[]>(
          `POST`,
          `/files/uploadrequests`,
          sanitizedData,
        );
      }
      throw error;
    }
  }

  async getFileCategories(params?: {
    pageSize?: number;
    pageNumber?: number;
    isActive?: boolean;
  }): Promise<BuildiumFileCategory[]> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    const suffix = queryParams.size ? `?${queryParams.toString()}` : '';

    const endpoints = [
      `/filecategories${suffix}`,
      `/FileCategories${suffix}`,
      `/fileCategories${suffix}`,
      `/Files/Categories${suffix}`,
      `/files/categories${suffix}`,
    ];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const result = await this.makeRequest<
          | BuildiumFileCategory[]
          | {
              data?: BuildiumFileCategory[];
              value?: BuildiumFileCategory[];
              items?: BuildiumFileCategory[];
              Items?: BuildiumFileCategory[];
            }
        >(`GET`, endpoint);
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result?.value)) return result.value;
        if (Array.isArray(result?.items)) return result.items;
        if (Array.isArray(result?.Items)) return result.Items;
        return [];
      } catch (error) {
        lastError = error as Error;
        const message = lastError.message ?? '';
        const is404 =
          message.includes('404') ||
          message.toLowerCase().includes('not found') ||
          message.toLowerCase().includes('case sensitive');
        if (is404) {
          continue;
        }
        throw lastError;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  async createLeaseDocumentUploadRequest(
    leaseId: number,
    data: {
      FileName: string;
      ContentType: string;
      Description?: string | null;
      Category?: string | null;
      IsPrivate?: boolean | null;
      PropertyId?: number | null;
      UnitId?: number | null;
    },
  ): Promise<unknown> {
    const sanitizedData = sanitizeForBuildium(data);
    const prefixes = [`/leases/${leaseId}`];
    const suffixes = [
      '/documents/uploadrequests',
      '/documents/uploadRequests',
      '/Documents/uploadrequests',
      '/Documents/uploadRequests',
      '/files/uploadrequests',
      '/files/uploadRequests',
      '/Files/uploadrequests',
      '/Files/uploadRequests',
    ];
    const endpoints = prefixes.flatMap((prefix) => suffixes.map((suffix) => `${prefix}${suffix}`));

    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      try {
        return await this.makeRequest<unknown>(`POST`, endpoint, sanitizedData);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Check if this is a 404 error (case-sensitive endpoint issue)
        const is404 =
          error instanceof Error &&
          (error.message.includes('404') ||
            error.message.includes('Not Found') ||
            error.message.toLowerCase().includes('case sensitive'));

        if (is404) {
          // Log which endpoint failed for debugging
          console.debug(`Lease document upload endpoint failed: ${endpoint}`, error.message);
          continue;
        }
        // If it's not a 404, throw immediately (other errors like 401, 500, etc.)
        throw error;
      }
    }

    // If all variations failed with 404, log and throw
    console.error(
      `All lease document upload endpoint variations failed for lease ${leaseId}. Last error:`,
      lastError?.message,
    );
    throw lastError || new Error('All endpoint variations failed');
  }

  async updateFileMetadata(
    fileId: number,
    data: {
      Title?: string | null;
      Description?: string | null;
      CategoryId?: number | null;
      Name?: string | null;
      IsPrivate?: boolean | null;
    },
  ): Promise<unknown> {
    const payload: Record<string, unknown> = {};
    if (data.Title !== undefined && data.Title !== null) payload.Title = data.Title;
    if (data.Description !== undefined) payload.Description = data.Description ?? '';
    if (data.CategoryId !== undefined && data.CategoryId !== null)
      payload.CategoryId = data.CategoryId;
    if (data.Name !== undefined && data.Name !== null) payload.Name = data.Name;
    if (data.IsPrivate !== undefined && data.IsPrivate !== null) payload.IsPrivate = data.IsPrivate;

    if (Object.keys(payload).length === 0) {
      throw new Error('No metadata fields provided for Buildium file update');
    }

    const sanitizedData = sanitizeForBuildium(payload);
    return this.makeRequest<unknown>(`PUT`, `/files/${fileId}`, sanitizedData);
  }

  async updateFileSharingSettings(
    fileId: number,
    settings: BuildiumFileShareSettingsUpdate,
  ): Promise<unknown> {
    const sanitizedData = sanitizeForBuildium(settings);
    return this.makeRequest<unknown>(`PUT`, `/files/${fileId}/sharing`, sanitizedData);
  }

  async getFileSharingSettings(fileId: number): Promise<BuildiumFileShareSettingsUpdate> {
    return this.makeRequest<BuildiumFileShareSettingsUpdate>(`GET`, `/files/${fileId}/sharing`);
  }

  async updateBill(
    id: number,
    data: Partial<BuildiumBillCreateEnhancedInput>,
  ): Promise<BuildiumBill> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumBill>(`PUT`, `/bills/${id}`, sanitizedData);
  }

  async deleteBill(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/bills/${id}`);
  }

  // ============================================================================
  // BANK ACCOUNT METHODS
  // ============================================================================

  async getBankAccounts(params?: {
    pageSize?: number;
    pageNumber?: number;
    isActive?: boolean;
  }): Promise<BuildiumApiResponse<BuildiumBankAccount>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    return this.makeRequest<BuildiumApiResponse<BuildiumBankAccount>>(
      `GET`,
      `/bankaccounts?${queryParams.toString()}`,
    );
  }

  async getBankAccount(id: number): Promise<BuildiumBankAccount> {
    return this.makeRequest<BuildiumBankAccount>(`GET`, `/bankaccounts/${id}`);
  }

  async createBankAccount(
    data: BuildiumBankAccountCreateEnhancedInput,
  ): Promise<BuildiumBankAccount> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumBankAccount>(`POST`, `/bankaccounts`, sanitizedData);
  }

  async updateBankAccount(
    id: number,
    data: Partial<BuildiumBankAccountCreateEnhancedInput>,
  ): Promise<BuildiumBankAccount> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumBankAccount>(`PUT`, `/bankaccounts/${id}`, sanitizedData);
  }

  async deleteBankAccount(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/bankaccounts/${id}`);
  }

  // ============================================================================
  // LEASE METHODS
  // ============================================================================

  async getLeases(params?: {
    pageSize?: number;
    pageNumber?: number;
    status?: string;
    propertyId?: number;
  }): Promise<BuildiumApiResponse<BuildiumLease>> {
    const queryParams = new URLSearchParams();
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.pageNumber) queryParams.append('pageNumber', params.pageNumber.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId.toString());
    const suffix = queryParams.toString();
    const query = suffix ? `?${suffix}` : '';

    return this.makeRequest<BuildiumApiResponse<BuildiumLease>>(`GET`, `/leases${query}`);
  }

  async getLease(id: number): Promise<BuildiumLease> {
    return this.makeRequest<BuildiumLease>(`GET`, `/leases/${id}`);
  }

  async createLease(data: BuildiumLeaseCreateEnhancedInput): Promise<BuildiumLease> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumLease>(`POST`, `/leases`, sanitizedData);
  }

  async updateLease(
    id: number,
    data: Partial<BuildiumLeaseCreateEnhancedInput>,
  ): Promise<BuildiumLease> {
    const sanitizedData = sanitizeForBuildium(data);

    return this.makeRequest<BuildiumLease>(`PUT`, `/leases/${id}`, sanitizedData);
  }

  async deleteLease(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/leases/${id}`);
  }

  async getLeaseRent(id: number): Promise<import('@/types/buildium').BuildiumLeaseRent> {
    return this.makeRequest<import('@/types/buildium').BuildiumLeaseRent>(
      `GET`,
      `/leases/${id}/rent`,
    );
  }

  // ============================================================================
  // WORK ORDER METHODS
  // ============================================================================

  async getWorkOrders(params?: {
    propertyId?: number;
    unitId?: number;
    status?: string;
    categoryId?: number;
    limit?: number;
    offset?: number;
  }): Promise<BuildiumWorkOrder[]> {
    const queryParams = new URLSearchParams();
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId.toString());
    if (params?.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.categoryId) queryParams.append('categoryId', params.categoryId.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    // Buildium returns an array for /workorders
    const result = await this.makeRequest<BuildiumWorkOrder[] | { Data?: BuildiumWorkOrder[] }>(
      `GET`,
      `/workorders?${queryParams.toString()}`,
    );
    // Some environments might wrap or not; normalize to array
    const wrappedData =
      !Array.isArray(result) && result && typeof result === 'object' && 'Data' in result
        ? (result as { Data?: BuildiumWorkOrder[] }).Data
        : null;
    const data = Array.isArray(wrappedData) ? wrappedData : Array.isArray(result) ? result : [];
    return data as BuildiumWorkOrder[];
  }

  async getWorkOrder(id: number): Promise<BuildiumWorkOrder> {
    return this.makeRequest<BuildiumWorkOrder>(`GET`, `/workorders/${id}`);
  }

  async createWorkOrder(data: BuildiumWorkOrderCreate): Promise<BuildiumWorkOrder> {
    const sanitizedData = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumWorkOrder>(`POST`, `/workorders`, sanitizedData);
  }

  async updateWorkOrder(id: number, data: BuildiumWorkOrderUpdate): Promise<BuildiumWorkOrder> {
    const sanitizedData = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumWorkOrder>(`PUT`, `/workorders/${id}`, sanitizedData);
  }

  // ============================================================================
  // APPLIANCE METHODS (Rental Appliances)
  // ============================================================================

  async getAppliances(params?: {
    propertyId?: number;
    unitId?: number;
    applianceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<BuildiumAppliance[]> {
    const queryParams = new URLSearchParams();
    if (params?.propertyId) queryParams.append('propertyId', params.propertyId.toString());
    if (params?.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params?.applianceType) queryParams.append('applianceType', params.applianceType);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    return this.makeRequest<BuildiumAppliance[]>(
      `GET`,
      `/rentals/appliances?${queryParams.toString()}`,
    );
  }

  async getAppliance(id: number): Promise<BuildiumAppliance> {
    return this.makeRequest<BuildiumAppliance>(`GET`, `/rentals/appliances/${id}`);
  }

  async createAppliance(data: BuildiumApplianceCreate): Promise<BuildiumAppliance> {
    const sanitizedData = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumAppliance>(`POST`, `/rentals/appliances`, sanitizedData);
  }

  async updateAppliance(id: number, data: BuildiumApplianceUpdate): Promise<BuildiumAppliance> {
    const sanitizedData = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumAppliance>(`PUT`, `/rentals/appliances/${id}`, sanitizedData);
  }

  async deleteAppliance(id: number): Promise<void> {
    return this.makeRequest<void>(`DELETE`, `/rentals/appliances/${id}`);
  }

  async listApplianceServiceHistory(
    applianceId: number,
    params?: { limit?: number; offset?: number },
  ): Promise<BuildiumApplianceServiceHistory[]> {
    const qp = new URLSearchParams();
    if (params?.limit) qp.append('limit', String(params.limit));
    if (params?.offset) qp.append('offset', String(params.offset));
    return this.makeRequest<BuildiumApplianceServiceHistory[]>(
      `GET`,
      `/rentals/appliances/${applianceId}/servicehistory?${qp.toString()}`,
    );
  }

  async getApplianceServiceHistory(
    applianceId: number,
    serviceHistoryId: number,
  ): Promise<BuildiumApplianceServiceHistory> {
    return this.makeRequest<BuildiumApplianceServiceHistory>(
      `GET`,
      `/rentals/appliances/${applianceId}/servicehistory/${serviceHistoryId}`,
    );
  }

  async createApplianceServiceHistory(
    applianceId: number,
    data: BuildiumApplianceServiceHistoryCreate,
  ): Promise<BuildiumApplianceServiceHistory> {
    const sanitized = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumApplianceServiceHistory>(
      `POST`,
      `/rentals/appliances/${applianceId}/servicehistory`,
      sanitized,
    );
  }

  async updateApplianceServiceHistory(
    applianceId: number,
    serviceHistoryId: number,
    data: BuildiumApplianceServiceHistoryUpdate,
  ): Promise<BuildiumApplianceServiceHistory> {
    const sanitized = sanitizeForBuildium(data);
    return this.makeRequest<BuildiumApplianceServiceHistory>(
      `PUT`,
      `/rentals/appliances/${applianceId}/servicehistory/${serviceHistoryId}`,
      sanitized,
    );
  }

  // ============================================================================
  // WEBHOOK METHODS
  // ============================================================================

  async processWebhook(payload: BuildiumWebhookPayload): Promise<void> {
    // Process webhook events
    for (const event of payload.Events) {
      await this.processWebhookEvent(event);
    }
  }

  private async processWebhookEvent(event: BuildiumWebhookEvent): Promise<void> {
    // This would be implemented based on your webhook processing logic
    console.log(`Processing webhook event: ${event.EventType} for entity ${event.EntityId}`);

    // You would typically:
    // 1. Validate the webhook signature
    // 2. Process the event based on type
    // 3. Update local database
    // 4. Log the event
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  public async makeRequest<T>(method: string, endpoint: string, data?: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-buildium-client-id': this.clientId,
      'x-buildium-client-secret': this.clientSecret,
    };

    const config: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          const errorData: Record<string, unknown> = await response
            .json()
            .catch(() => ({}) as Record<string, unknown>);
          let extra = '';
          const errors =
            (errorData as { Errors?: unknown; errors?: unknown; Data?: unknown })?.Errors ||
            (errorData as { Errors?: unknown; errors?: unknown; Data?: unknown })?.errors ||
            (errorData as { Errors?: unknown; errors?: unknown; Data?: unknown })?.Data;
          if (Array.isArray(errors) && errors.length) {
            extra = errors
              .map((entry: Record<string, unknown>) => {
                const key = entry?.Key || entry?.Field || entry?.Code || 'Field';
                const value =
                  entry?.Value || entry?.Message || entry?.Description || JSON.stringify(entry);
                return `${key}: ${value}`;
              })
              .join('; ');
          } else if (errorData && typeof errorData === 'object' && Object.keys(errorData).length) {
            extra = JSON.stringify(errorData);
          }
          const message = extra
            ? `Buildium API error: ${response.status} ${response.statusText} - ${extra}`
            : `Buildium API error: ${response.status} ${response.statusText} - Unknown error`;
          throw new Error(message);
        }

        const result = await response.json();

        if (!validateBuildiumResponse(result)) {
          throw new Error('Invalid response from Buildium API');
        }

        return result as T;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async batchCreateProperties(
    properties: BuildiumPropertyCreateEnhancedInput[],
  ): Promise<BuildiumProperty[]> {
    const results: BuildiumProperty[] = [];

    for (const property of properties) {
      try {
        const result = await this.createProperty(property);
        results.push(result);
      } catch (error) {
        console.error(`Failed to create property: ${error}`);
        throw error;
      }
    }

    return results;
  }

  async batchCreateUnits(
    propertyId: number,
    units: BuildiumUnitCreateEnhancedInput[],
  ): Promise<BuildiumUnit[]> {
    const results: BuildiumUnit[] = [];

    for (const unit of units) {
      try {
        const result = await this.createUnit(propertyId, unit);
        results.push(result);
      } catch (error) {
        console.error(`Failed to create unit: ${error}`);
        throw error;
      }
    }

    return results;
  }

  // ============================================================================
  // SYNC HELPERS
  // ============================================================================

  async syncPropertyToBuildium(localProperty: Record<string, unknown>): Promise<number | null> {
    try {
      const buildiumId =
        typeof localProperty.buildium_property_id === 'number'
          ? localProperty.buildium_property_id
          : localProperty.buildium_property_id
            ? Number(localProperty.buildium_property_id)
            : null;

      if (buildiumId) {
        // Update existing property
        await this.updateProperty(buildiumId, localProperty as any);
        return buildiumId;
      } else {
        // Create new property
        const buildiumProperty = await this.createProperty(localProperty as any);
        return buildiumProperty.Id;
      }
    } catch (error) {
      console.error(`Failed to sync property to Buildium: ${error}`);
      throw error;
    }
  }

  async syncUnitToBuildium(
    propertyId: number,
    localUnit: Record<string, unknown>,
  ): Promise<number | null> {
    try {
      const buildiumUnitId =
        typeof localUnit.buildium_unit_id === 'number'
          ? localUnit.buildium_unit_id
          : localUnit.buildium_unit_id
            ? Number(localUnit.buildium_unit_id)
            : null;

      if (buildiumUnitId) {
        // Update existing unit
        await this.updateUnit(propertyId, buildiumUnitId, localUnit as any);
        return buildiumUnitId;
      } else {
        // Create new unit
        const buildiumUnit = await this.createUnit(propertyId, localUnit as any);
        return buildiumUnit.Id;
      }
    } catch (error) {
      console.error(`Failed to sync unit to Buildium: ${error}`);
      throw error;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createBuildiumClient(config: BuildiumApiConfig): BuildiumClient {
  return new BuildiumClient(config);
}

/**
 * Get org-scoped Buildium client
 *
 * BREAKING CHANGE: Now requires orgId parameter (or explicit undefined for system jobs)
 * All credential access flows through getOrgScopedBuildiumConfig (central choke point)
 *
 * @param orgId - Organization ID (undefined for system jobs without org context)
 * @param config - Optional partial config to override defaults
 * @returns Configured BuildiumClient instance
 */
export async function getOrgScopedBuildiumClient(
  orgId?: string | undefined,
  config?: Partial<BuildiumApiConfig>,
): Promise<BuildiumClient> {
  const { getOrgScopedBuildiumConfig } = await import('./buildium/credentials-manager');
  const credentials = await getOrgScopedBuildiumConfig(orgId);

  if (!credentials) {
    throw new Error(
      orgId
        ? `Buildium credentials not available for org ${orgId}`
        : 'Buildium credentials not available (no orgId provided and no env vars)',
    );
  }

  const clientConfig: BuildiumApiConfig = {
    baseUrl: credentials.baseUrl,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    timeout: config?.timeout || 30000,
    retryAttempts: config?.retryAttempts || 3,
    retryDelay: config?.retryDelay || 1000,
    ...config,
  };

  return new BuildiumClient(clientConfig);
}

/**
 * Create Buildium client with org-scoped credentials
 *
 * BREAKING CHANGE: Now requires orgId parameter (or explicit undefined for system jobs)
 *
 * @deprecated Use getOrgScopedBuildiumClient instead
 * This function is kept for backward compatibility but will be removed after migration
 */
export async function createBuildiumClientWithOrg(
  orgId?: string | undefined,
  config?: Partial<BuildiumApiConfig>,
): Promise<BuildiumClient> {
  console.warn('createBuildiumClientWithOrg called - please migrate to getOrgScopedBuildiumClient');
  return getOrgScopedBuildiumClient(orgId, config);
}

// ============================================================================
// DEFAULT CONFIG (DEPRECATED)
// ============================================================================

/**
 * @deprecated Use getOrgScopedBuildiumClient instead
 * This config is kept for backward compatibility but will be removed after migration
 */
export const defaultBuildiumConfig: BuildiumApiConfig = {
  baseUrl: process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1',
  clientId: process.env.BUILDIUM_CLIENT_ID || '',
  clientSecret: process.env.BUILDIUM_CLIENT_SECRET || '',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};
