import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types for Buildium API
interface BuildiumApiConfig {
  baseUrl: string
  apiKey: string
  clientId?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

interface BuildiumProperty {
  Id: number
  Name: string
  PropertyType: 'Rental' | 'Association' | 'Commercial'
  Address: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  YearBuilt?: number
  SquareFootage?: number
  Bedrooms?: number
  Bathrooms?: number
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
}

interface BuildiumOwner {
  Id: number
  FirstName: string
  LastName: string
  Email?: string
  PhoneNumber?: string
  Address: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  TaxId?: string
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
}

interface BuildiumUnit {
  Id: number
  UnitNumber: string
  UnitType: string
  SquareFootage?: number
  MarketRent?: number
  Bedrooms?: number
  Bathrooms?: number
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
  Address?: {
    AddressLine1: string
    AddressLine2?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
}

// --- Leases ---
interface BuildiumLeaseAccountDetails {
  Rent?: number | null
  SecurityDeposit?: number | null
  ProratedFirstMonthRent?: number | null
  ProratedLastMonthRent?: number | null
}

interface BuildiumLeasePersonAddress {
  AddressLine1?: string | null
  AddressLine2?: string | null
  AddressLine3?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  Country?: string | null
}

interface BuildiumLeasePersonPhoneNumbers {
  Home?: string | null
  Work?: string | null
  Mobile?: string | null
}

interface BuildiumLeasePersonEmergencyContact {
  Name?: string | null
  RelationshipDescription?: string | null
  Phone?: string | null
  Email?: string | null
}

interface BuildiumLeasePerson {
  Id?: number | null
  FirstName?: string | null
  LastName?: string | null
  Email?: string | null
  AlternateEmail?: string | null
  PhoneNumbers?: BuildiumLeasePersonPhoneNumbers | null
  DateOfBirth?: string | null
  Comment?: string | null
  EmergencyContact?: BuildiumLeasePersonEmergencyContact | null
  PrimaryAddress?: BuildiumLeasePersonAddress | null
  AlternateAddress?: BuildiumLeasePersonAddress | null
  MailingPreference?: string | null
  TaxId?: string | null
  SMSOptInStatus?: boolean | null
}

interface BuildiumLease {
  Id: number
  PropertyId: number
  UnitId: number
  UnitNumber?: string | null
  LeaseFromDate: string
  LeaseToDate?: string | null
  LeaseType?: string | null
  LeaseStatus: 'Future' | 'Active' | 'Past' | 'Cancelled'
  TermType?: string | null
  RenewalOfferStatus?: string | null
  CurrentNumberOfOccupants?: number | null
  IsEvictionPending?: boolean | null
  AutomaticallyMoveOutTenants?: boolean | null
  PaymentDueDay?: number | null
  AccountDetails?: BuildiumLeaseAccountDetails | null
  Tenants?: BuildiumLeasePerson[]
  Cosigners?: BuildiumLeasePerson[]
  CreatedDateTime?: string
  LastUpdatedDateTime?: string
}

// Lease Transactions (simplified per v1)
interface BuildiumLeaseTransactionJournalLine {
  GLAccount?: { Id?: number }
  Amount?: number
  Memo?: string | null
  PropertyId?: number | null
  UnitId?: number | null
  AccountingEntity?: { AccountingEntityType?: string | null } | null
}
interface BuildiumLeaseTransactionJournal {
  Memo?: string | null
  Lines?: BuildiumLeaseTransactionJournalLine[]
}
interface BuildiumLeaseTransaction {
  Id: number
  Date: string
  LeaseId?: number
  TransactionType?: string
  TotalAmount?: number
  CheckNumber?: string | null
  PaymentMethod?: string | null
  Journal?: BuildiumLeaseTransactionJournal
}

// --- Appliances ---
type BuildiumApplianceType =
  | 'AirConditioner' | 'Dishwasher' | 'Dryer' | 'Freezer' | 'GarbageDisposal'
  | 'Heater' | 'Microwave' | 'Oven' | 'Refrigerator' | 'Stove' | 'Washer'
  | 'WaterHeater' | 'Other'

interface BuildiumAppliance {
  Id: number
  PropertyId: number
  UnitId?: number | null
  Name: string
  Description?: string | null
  ApplianceType: BuildiumApplianceType
  Manufacturer?: string | null
  Model?: string | null
  SerialNumber?: string | null
  WarrantyExpirationDate?: string | null
  InstallationDate?: string | null
  IsActive?: boolean
  CreatedDateTime?: string
  LastUpdatedDateTime?: string
}

type BuildiumApplianceServiceType = 'Maintenance' | 'Repair' | 'Replacement' | 'Installation' | 'Inspection' | 'Other'

interface BuildiumApplianceServiceHistory {
  Id: number
  ServiceDate: string
  ServiceType: BuildiumApplianceServiceType
  Description?: string | null
  Cost?: number | null
  VendorName?: string | null
  Notes?: string | null
  CreatedDateTime?: string
  LastUpdatedDateTime?: string
}

// --- Bank Accounts & GL Accounts ---
interface BuildiumGLAccount {
  Id: number
  AccountNumber?: string
  Name: string
  Description?: string
  Type: string
  SubType?: string
  IsDefaultGLAccount?: boolean
  DefaultAccountName?: string
  IsContraAccount?: boolean
  IsBankAccount?: boolean
  CashFlowClassification?: string
  ExcludeFromCashBalances?: boolean
  IsActive?: boolean
  ParentGLAccountId?: number | null
  IsCreditCardAccount?: boolean
  SubAccounts?: Array<{ Id: number }>
}

interface BuildiumBankAccount {
  Id: number
  Name: string
  Description?: string
  BankAccountType: 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit'
  Country?: string
  AccountNumber?: string
  AccountNumberUnmasked?: string
  RoutingNumber?: string
  IsActive: boolean
  Balance?: number
  GLAccount?: BuildiumGLAccount
}

// --- Work Orders ---
interface BuildiumWorkOrder {
  Id: number
  Category?: { Id: number; Name?: string; Href?: string; SubCategory?: { Id: number; Name?: string } }
  Title?: string
  Subject?: string
  Description?: string
  Property: { Id: number; Type: string; Href?: string }
  UnitId?: number | null
  RequestedByUserEntity?: { Type: string; Id: number; FirstName?: string; LastName?: string; IsCompany?: boolean; Href?: string }
  AssignedToUserId?: number | null
  WorkOrderStatus?: 'New' | 'InProgress' | 'Completed' | 'Cancelled'
  Priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
  DueDate?: string
  CreatedDateTime?: string
  LastUpdatedDateTime?: string
}

// Buildium API Client - Direct API calls with client credentials
class BuildiumClient {
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number

  constructor(config: { baseUrl?: string; clientId?: string; clientSecret?: string; timeout?: number; retryAttempts?: number; retryDelay?: number }) {
    this.baseUrl = config.baseUrl || 'https://apisandbox.buildium.com/v1'
    this.clientId = config.clientId || ''
    this.clientSecret = config.clientSecret || ''
    this.timeout = config.timeout || 30000
    this.retryAttempts = config.retryAttempts || 3
    this.retryDelay = config.retryDelay || 1000
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-buildium-client-id': this.clientId,
        'x-buildium-client-secret': this.clientSecret
      },
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
          throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`)
        }

        const result = await response.json()
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

  async createProperty(data: any): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>('POST', '/rentals', data)
  }

  async updateProperty(id: number, data: any): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>('PUT', `/rentals/${id}`, data)
  }

  async createOwner(data: any): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>('POST', '/rentals/owners', data)
  }

  async updateOwner(id: number, data: any): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>('PUT', `/rentals/owners/${id}`, data)
  }

  async getProperty(id: number): Promise<BuildiumProperty> {
    return this.makeRequest<BuildiumProperty>('GET', `/rentals/${id}`)
  }

  async getUnits(propertyId: number): Promise<BuildiumUnit[]> {
    return this.makeRequest<BuildiumUnit[]>('GET', `/rentals/${propertyId}/units`)
  }

  async getOwner(id: number): Promise<BuildiumOwner> {
    return this.makeRequest<BuildiumOwner>('GET', `/rentals/owners/${id}`)
  }
  async listProperties(params?: Record<string,string|number|boolean>): Promise<BuildiumProperty[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumProperty[]>('GET', `/rentals${qs}`)
  }
  async listOwners(params?: Record<string, string | number | boolean>): Promise<BuildiumOwner[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumOwner[]>('GET', `/rentals/owners${qs}`)
  }

  // GL Accounts
  async getGLAccount(id: number): Promise<BuildiumGLAccount> {
    return this.makeRequest<BuildiumGLAccount>('GET', `/glaccounts/${id}`)
  }
  async listGLAccounts(params?: Record<string, string | number | boolean>): Promise<BuildiumGLAccount[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumGLAccount[]>('GET', `/glaccounts${qs}`)
  }

  async listGLEntries(params?: Record<string, string | number | boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/glentries${qs}`)
  }
  async getGLEntry(id: number): Promise<any> {
    return this.makeRequest<any>('GET', `/glentries/${id}`)
  }
  async listGLTransactions(params?: Record<string, string | number | boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/gltransactions${qs}`)
  }
  async getGLAccountBalance(id: number, asOfDate?: string): Promise<any> {
    const qs = asOfDate ? `?${new URLSearchParams({ asOfDate })}` : ''
    return this.makeRequest<any>('GET', `/glaccounts/${id}/balances${qs}`)
  }

  // Bank Accounts
  async listBankAccounts(params?: Record<string, string | number | boolean>): Promise<BuildiumBankAccount[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumBankAccount[]>('GET', `/bankaccounts${qs}`)
  }
  async getBankAccount(id: number): Promise<BuildiumBankAccount> {
    return this.makeRequest<BuildiumBankAccount>('GET', `/bankaccounts/${id}`)
  }
  async createBankAccount(data: any): Promise<BuildiumBankAccount> {
    return this.makeRequest<BuildiumBankAccount>('POST', `/bankaccounts`, data)
  }
  async updateBankAccount(id: number, data: any): Promise<BuildiumBankAccount> {
    return this.makeRequest<BuildiumBankAccount>('PUT', `/bankaccounts/${id}`, data)
  }

  // Work Orders
  async listWorkOrders(params?: Record<string, string | number | boolean>): Promise<BuildiumWorkOrder[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    const result = await this.makeRequest<any>('GET', `/workorders${qs}`)
    // Some tenants return array directly; normalize
    return Array.isArray(result?.Data) ? result.Data : (Array.isArray(result) ? result : [])
  }
  async getWorkOrder(id: number): Promise<BuildiumWorkOrder> {
    return this.makeRequest<BuildiumWorkOrder>('GET', `/workorders/${id}`)
  }
  async createWorkOrder(data: any): Promise<BuildiumWorkOrder> {
    return this.makeRequest<BuildiumWorkOrder>('POST', `/workorders`, data)
  }
  async updateWorkOrder(id: number, data: any): Promise<BuildiumWorkOrder> {
    return this.makeRequest<BuildiumWorkOrder>('PUT', `/workorders/${id}`, data)
  }

  // Appliances
  async listAppliances(params?: Record<string, string | number | boolean>): Promise<BuildiumAppliance[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumAppliance[]>('GET', `/rentals/appliances${qs}`)
  }
  async getAppliance(id: number): Promise<BuildiumAppliance> {
    return this.makeRequest<BuildiumAppliance>('GET', `/rentals/appliances/${id}`)
  }
  async createAppliance(data: any): Promise<BuildiumAppliance> {
    return this.makeRequest<BuildiumAppliance>('POST', `/rentals/appliances`, data)
  }
  async updateAppliance(id: number, data: any): Promise<BuildiumAppliance> {
    return this.makeRequest<BuildiumAppliance>('PUT', `/rentals/appliances/${id}`, data)
  }
  async deleteAppliance(id: number): Promise<any> {
    return this.makeRequest<any>('DELETE', `/rentals/appliances/${id}`)
  }
  async listApplianceServiceHistory(applianceId: number, params?: Record<string,string|number|boolean>): Promise<BuildiumApplianceServiceHistory[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumApplianceServiceHistory[]>('GET', `/rentals/appliances/${applianceId}/servicehistory${qs}`)
  }
  async getApplianceServiceHistory(applianceId: number, serviceHistoryId: number): Promise<BuildiumApplianceServiceHistory> {
    return this.makeRequest<BuildiumApplianceServiceHistory>('GET', `/rentals/appliances/${applianceId}/servicehistory/${serviceHistoryId}`)
  }
  async createApplianceServiceHistory(applianceId: number, data: any): Promise<BuildiumApplianceServiceHistory> {
    return this.makeRequest<BuildiumApplianceServiceHistory>('POST', `/rentals/appliances/${applianceId}/servicehistory`, data)
  }
  async updateApplianceServiceHistory(applianceId: number, serviceHistoryId: number, data: any): Promise<BuildiumApplianceServiceHistory> {
    return this.makeRequest<BuildiumApplianceServiceHistory>('PUT', `/rentals/appliances/${applianceId}/servicehistory/${serviceHistoryId}`, data)
  }

  // Lease Notes
  async listLeaseNotes(leaseId: number, params?: Record<string,string|number|boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/leases/${leaseId}/notes${qs}`)
  }
  async getLeaseNote(leaseId: number, noteId: number): Promise<any> {
    return this.makeRequest<any>('GET', `/leases/${leaseId}/notes/${noteId}`)
  }
  async createLeaseNote(leaseId: number, data: any): Promise<any> {
    return this.makeRequest<any>('POST', `/leases/${leaseId}/notes`, data)
  }
  async updateLeaseNote(leaseId: number, noteId: number, data: any): Promise<any> {
    return this.makeRequest<any>('PUT', `/leases/${leaseId}/notes/${noteId}`, data)
  }

  // Lease Recurring Transactions
  async listLeaseRecurring(leaseId: number, params?: Record<string,string|number|boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/leases/${leaseId}/recurring-transactions${qs}`)
  }
  async getLeaseRecurring(leaseId: number, recurringId: number): Promise<any> {
    return this.makeRequest<any>('GET', `/leases/${leaseId}/recurring-transactions/${recurringId}`)
  }
  async createLeaseRecurring(leaseId: number, data: any): Promise<any> {
    return this.makeRequest<any>('POST', `/leases/${leaseId}/recurring-transactions`, data)
  }
  async updateLeaseRecurring(leaseId: number, recurringId: number, data: any): Promise<any> {
    return this.makeRequest<any>('PUT', `/leases/${leaseId}/recurring-transactions/${recurringId}`, data)
  }
  async deleteLeaseRecurring(leaseId: number, recurringId: number): Promise<any> {
    return this.makeRequest<any>('DELETE', `/leases/${leaseId}/recurring-transactions/${recurringId}`)
  }

  // Lease Move Outs
  async listLeaseMoveOuts(leaseId: number, params?: Record<string,string|number|boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/leases/${leaseId}/moveouts${qs}`)
  }
  async getLeaseMoveOut(leaseId: number, moveOutId: number): Promise<any> {
    return this.makeRequest<any>('GET', `/leases/${leaseId}/moveouts/${moveOutId}`)
  }
  async createLeaseMoveOut(leaseId: number, data: any): Promise<any> {
    return this.makeRequest<any>('POST', `/leases/${leaseId}/moveouts`, data)
  }
  async deleteLeaseMoveOut(leaseId: number, moveOutId: number): Promise<any> {
    return this.makeRequest<any>('DELETE', `/leases/${leaseId}/moveouts/${moveOutId}`)
  }

  // Raw passthrough (use sparingly; keeps secrets at Edge)
  async raw(method: string, path: string, params?: Record<string,string|number|boolean>, body?: any): Promise<any> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    const clean = path.startsWith('/') ? path : `/${path}`
    const full = `${clean}${qs}`
    return this.makeRequest<any>(method.toUpperCase(), full, body)
  }

  // Tenants
  async listTenants(params?: Record<string, string | number | boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/rentals/tenants${qs}`)
  }
  async getTenant(id: number): Promise<any> {
    return this.makeRequest<any>('GET', `/rentals/tenants/${id}`)
  }
  async createTenant(data: any): Promise<any> {
    return this.makeRequest<any>('POST', `/rentals/tenants`, data)
  }
  async updateTenant(id: number, data: any): Promise<any> {
    return this.makeRequest<any>('PUT', `/rentals/tenants/${id}`, data)
  }
  async listTenantNotes(tenantId: number, params?: Record<string,string|number|boolean>): Promise<any[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<any[]>('GET', `/rentals/tenants/${tenantId}/notes${qs}`)
  }
  async getTenantNote(tenantId: number, noteId: number): Promise<any> {
    return this.makeRequest<any>('GET', `/rentals/tenants/${tenantId}/notes/${noteId}`)
  }
  async createTenantNote(tenantId: number, data: any): Promise<any> {
    return this.makeRequest<any>('POST', `/rentals/tenants/${tenantId}/notes`, data)
  }
  async updateTenantNote(tenantId: number, noteId: number, data: any): Promise<any> {
    return this.makeRequest<any>('PUT', `/rentals/tenants/${tenantId}/notes/${noteId}`, data)
  }

  // Leases
  async listLeases(params?: Record<string, string | number | boolean | (number[]) | (string[])>): Promise<BuildiumLease[]> {
    const qp = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue
        if (Array.isArray(v)) qp.append(k, v.join(','))
        else qp.append(k, String(v))
      }
    }
    return this.makeRequest<BuildiumLease>('GET', `/leases?${qp.toString()}`) as unknown as BuildiumLease[]
  }
  async getLease(id: number): Promise<BuildiumLease> {
    return this.makeRequest<BuildiumLease>('GET', `/leases/${id}`)
  }
  async createLease(data: any): Promise<BuildiumLease> {
    return this.makeRequest<BuildiumLease>('POST', `/leases`, data)
  }
  async updateLease(id: number, data: any): Promise<BuildiumLease> {
    return this.makeRequest<BuildiumLease>('PUT', `/leases/${id}`, data)
  }

  // Lease Transactions
  async listLeaseTransactions(leaseId: number, params?: Record<string,string|number|boolean>): Promise<BuildiumLeaseTransaction[]> {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]))}` : ''
    return this.makeRequest<BuildiumLeaseTransaction[]>('GET', `/leases/${leaseId}/transactions${qs}`)
  }
  async getLeaseTransaction(leaseId: number, transactionId: number): Promise<BuildiumLeaseTransaction> {
    return this.makeRequest<BuildiumLeaseTransaction>('GET', `/leases/${leaseId}/transactions/${transactionId}`)
  }
}

// Data mapping functions
function mapPropertyToBuildium(localProperty: any): any {
  return {
    Name: localProperty.Name,
    PropertyType: mapPropertyTypeToBuildium(localProperty.rental_sub_type),
    Address: {
      AddressLine1: localProperty.address_line1,
      AddressLine2: localProperty.address_line2 || undefined,
      City: localProperty.city || '',
      State: localProperty.state || '',
      PostalCode: localProperty.postal_code,
      Country: localProperty.country
    },
    YearBuilt: localProperty.year_built || undefined,
    SquareFootage: localProperty.square_footage || undefined,
    Bedrooms: localProperty.bedrooms || undefined,
    Bathrooms: localProperty.bathrooms || undefined,
    IsActive: localProperty.is_active !== false
  }
}

function mapOwnerToBuildium(localOwner: any): any {
  const [firstName, ...lastNameParts] = (localOwner.name || '').split(' ')
  const lastName = lastNameParts.join(' ') || ''

  return {
    FirstName: firstName || '',
    LastName: lastName,
    Email: localOwner.email || undefined,
    PhoneNumber: localOwner.phone_number || undefined,
    Address: {
      AddressLine1: localOwner.address_line1 || '',
      AddressLine2: localOwner.address_line2 || undefined,
      City: localOwner.city || '',
      State: localOwner.state || '',
      PostalCode: localOwner.postal_code || '',
      Country: localOwner.country || 'US'
    },
    TaxId: localOwner.tax_id || undefined,
    IsActive: localOwner.is_active !== false
  }
}

// ---------- Owner upsert helpers (contacts + owners) ----------
function mapCountryFromBuildium(country?: string | null): string | null {
  if (!country) return null
  const spaced = country.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced
}

function mapOwnerToContactFromBuildium(o: BuildiumOwner) {
  return {
    is_company: false,
    first_name: o.FirstName || null,
    last_name: o.LastName || null,
    company_name: null,
    primary_email: o.Email || null,
    alt_email: null,
    primary_phone: o.PhoneNumber || null,
    alt_phone: null,
    date_of_birth: null,
    primary_address_line_1: o.Address?.AddressLine1 || null,
    primary_address_line_2: o.Address?.AddressLine2 || null,
    primary_address_line_3: o.Address?.AddressLine3 || null,
    primary_city: o.Address?.City || null,
    primary_state: o.Address?.State || null,
    primary_postal_code: o.Address?.PostalCode || null,
    primary_country: mapCountryFromBuildium(o.Address?.Country),
    alt_address_line_1: null,
    alt_address_line_2: null,
    alt_address_line_3: null,
    alt_city: null,
    alt_state: null,
    alt_postal_code: null,
    alt_country: null,
    mailing_preference: 'primary'
  }
}

async function findOrCreateOwnerContactEdge(o: BuildiumOwner, supabase: any): Promise<number> {
  const email = o.Email || null
  if (email) {
    const { data: existing, error: findErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('primary_email', email)
      .single()
    if (findErr && findErr.code !== 'PGRST116') throw findErr
    if (existing) {
      const mapped = mapOwnerToContactFromBuildium(o)
      const update: Record<string, any> = {}
      for (const [k,v] of Object.entries(mapped)) {
        if (v !== null && v !== '' && (existing as any)[k] == null) update[k] = v
      }
      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('contacts').update(update).eq('id', existing.id)
        if (error) throw error
      }
      return existing.id
    }
  }
  const payload = mapOwnerToContactFromBuildium(o)
  const now = new Date().toISOString()
  const { data: created, error: insErr } = await supabase
    .from('contacts')
    .insert({ ...payload, created_at: now, updated_at: now })
    .select('id')
    .single()
  if (insErr) throw insErr
  return created.id
}

async function upsertOwnerFromBuildiumEdge(o: BuildiumOwner, supabase: any): Promise<{ ownerId: string; created: boolean }>{
  const contactId = await findOrCreateOwnerContactEdge(o, supabase)
  const now = new Date().toISOString()
  const base: any = {
    contact_id: contactId,
    is_active: true,
    management_agreement_start_date: o.ManagementAgreementStartDate || null,
    management_agreement_end_date: o.ManagementAgreementEndDate || null,
    tax_address_line1: null,
    tax_address_line2: null,
    tax_address_line3: null,
    tax_city: null,
    tax_state: null,
    tax_postal_code: null,
    tax_country: null,
    tax_payer_id: o.TaxId || null,
    tax_payer_name1: null,
    tax_payer_name2: null,
    tax_include1099: null,
    buildium_owner_id: o.Id,
    buildium_created_at: o.CreatedDate || null,
    buildium_updated_at: o.ModifiedDate || null,
    updated_at: now
  }

  const { data: existing, error: findErr } = await supabase
    .from('owners')
    .select('id')
    .eq('buildium_owner_id', o.Id)
    .single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr
  if (existing) {
    const { error } = await supabase.from('owners').update(base).eq('id', existing.id)
    if (error) throw error
    return { ownerId: existing.id, created: false }
  } else {
    const insertPayload = { ...base, created_at: now }
    const { data: created, error } = await supabase
      .from('owners')
      .insert(insertPayload)
      .select('id')
      .single()
    if (error) throw error
    return { ownerId: created.id, created: true }
  }
}

function mapPropertyTypeToBuildium(localType: string): 'Rental' | 'Association' | 'Commercial' {
  switch (localType) {
    case 'Office':
    case 'Retail':
    case 'ShoppingCenter':
    case 'Storage':
    case 'ParkingSpace':
      return 'Commercial'
    default:
      return 'Rental'
  }
}

function sanitizeForBuildium(data: any): any {
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key]
    }
  })
  
  return sanitized
}

// ---------- Appliance mapping helpers ----------
async function mapApplianceFromBuildium(appliance: BuildiumAppliance, supabase: any) {
  const now = new Date().toISOString()
  // Resolve unit UUID by buildium UnitId
  let unitUuid: string | null = null
  if (appliance.UnitId) {
    const { data } = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', appliance.UnitId)
      .single()
    unitUuid = data?.id ?? null
  }
  // Resolve property UUID by buildium PropertyId
  let propertyUuid: string | null = null
  if (appliance.PropertyId) {
    const { data: p } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', appliance.PropertyId)
      .single()
    propertyUuid = p?.id ?? null
  }
  return {
    buildium_appliance_id: appliance.Id,
    unit_id: unitUuid,
    property_id: propertyUuid,
    name: appliance.Name || appliance.ApplianceType,
    type: String(appliance.ApplianceType || ''),
    manufacturer: appliance.Manufacturer ?? null,
    model_number: appliance.Model ?? null,
    serial_number: appliance.SerialNumber ?? null,
    installation_date: appliance.InstallationDate ? new Date(appliance.InstallationDate).toISOString().slice(0,10) : null,
    warranty_expiration_date: appliance.WarrantyExpirationDate ? new Date(appliance.WarrantyExpirationDate).toISOString().slice(0,10) : null,
    description: appliance.Description ?? null,
    is_active: typeof appliance.IsActive === 'boolean' ? appliance.IsActive : true,
    created_at: now,
    updated_at: now
  }
}

async function toBuildiumAppliance(payload: any, supabase: any) {
  // Map local UUID relationships to Buildium IDs
  let PropertyId: number | undefined = payload?.PropertyId
  let UnitId: number | undefined = payload?.UnitId

  if (!UnitId && (payload?.unit_id || payload?.unitId)) {
    const { data } = await supabase
      .from('units')
      .select('buildium_unit_id, property_id')
      .eq('id', payload.unit_id || payload.unitId)
      .single()
    UnitId = data?.buildium_unit_id || undefined
    if (!PropertyId && data?.property_id) {
      const { data: p } = await supabase
        .from('properties')
        .select('buildium_property_id')
        .eq('id', data.property_id)
        .single()
      PropertyId = p?.buildium_property_id || undefined
    }
  }

  if (!PropertyId && (payload?.property_id || payload?.propertyId)) {
    const { data: p } = await supabase
      .from('properties')
      .select('buildium_property_id')
      .eq('id', payload.property_id || payload.propertyId)
      .single()
    PropertyId = p?.buildium_property_id || undefined
  }

  const out: any = {
    PropertyId,
    UnitId,
    Name: payload.name || payload.Name || 'Appliance',
    Description: payload.description || payload.Description || undefined,
    ApplianceType: payload.ApplianceType || payload.type,
    Manufacturer: payload.manufacturer || payload.Manufacturer || undefined,
    Model: payload.model_number || payload.Model || undefined,
    SerialNumber: payload.serial_number || payload.SerialNumber || undefined,
    InstallationDate: payload.installation_date || payload.InstallationDate || undefined,
    WarrantyExpirationDate: payload.warranty_expiration_date || payload.WarrantyExpirationDate || undefined,
    IsActive: typeof payload.is_active === 'boolean' ? payload.is_active : (payload.IsActive ?? true)
  }
  Object.keys(out).forEach(k => out[k] == null && delete out[k])
  return out
}

// ---------- Lease mapping helpers ----------
async function resolvePropertyUuidByBuildiumId(supabase: any, buildiumPropertyId: number | null | undefined): Promise<string | null> {
  if (!buildiumPropertyId) return null
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveUnitUuidByBuildiumId(supabase: any, buildiumUnitId: number | null | undefined): Promise<string | null> {
  if (!buildiumUnitId) return null
  const { data, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

function mapLeaseStatusFromBuildium(status: string | null | undefined): string {
  switch (status) {
    case 'Future': return 'future'
    case 'Past': return 'past'
    case 'Cancelled': return 'cancelled'
    default: return 'active'
  }
}

async function mapLeaseFromBuildium(lease: BuildiumLease, supabase: any) {
  const propertyUuid = await resolvePropertyUuidByBuildiumId(supabase, lease.PropertyId)
  const unitUuid = await resolveUnitUuidByBuildiumId(supabase, lease.UnitId)

  return {
    buildium_lease_id: lease.Id,
    buildium_property_id: lease.PropertyId ?? null,
    buildium_unit_id: lease.UnitId ?? null,
    unit_number: lease.UnitNumber ?? null,
    lease_from_date: lease.LeaseFromDate,
    lease_to_date: lease.LeaseToDate ?? null,
    lease_type: lease.LeaseType ?? null,
    status: mapLeaseStatusFromBuildium(lease.LeaseStatus),
    is_eviction_pending: typeof lease.IsEvictionPending === 'boolean' ? lease.IsEvictionPending : null,
    term_type: lease.TermType ?? null,
    renewal_offer_status: lease.RenewalOfferStatus ?? null,
    current_number_of_occupants: lease.CurrentNumberOfOccupants ?? null,
    security_deposit: lease.AccountDetails?.SecurityDeposit ?? null,
    rent_amount: lease.AccountDetails?.Rent ?? null,
    automatically_move_out_tenants: typeof lease.AutomaticallyMoveOutTenants === 'boolean' ? lease.AutomaticallyMoveOutTenants : null,
    buildium_created_at: lease.CreatedDateTime ?? null,
    buildium_updated_at: lease.LastUpdatedDateTime ?? null,
    payment_due_day: lease.PaymentDueDay ?? null,
    property_id: propertyUuid!,
    unit_id: unitUuid!,
    updated_at: new Date().toISOString()
  }
}

async function upsertLeaseFromBuildium(lease: BuildiumLease, supabase: any): Promise<number> {
  // Map to local shape
  const mapped = await mapLeaseFromBuildium(lease, supabase)

  // Ensure we have required FKs
  if (!mapped.property_id || !mapped.unit_id) {
    throw new Error(`Missing local property/unit for Buildium lease ${lease.Id}. Sync properties/units first.`)
  }

  // Does a local row exist?
  const { data: existing, error: findErr } = await supabase
    .from('lease')
    .select('id')
    .eq('buildium_lease_id', lease.Id)
    .single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from('lease')
      .update(mapped)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    return updated.id
  } else {
    const toInsert = { ...mapped, created_at: new Date().toISOString() }
    const { data: inserted, error } = await supabase
      .from('lease')
      .insert(toInsert)
      .select('id')
      .single()
    if (error) throw error
    return inserted.id
  }
}

async function findOrCreateContactForLeasePerson(person: BuildiumLeasePerson, supabase: any): Promise<number> {
  // Try to match by buildium_contact_id if present (some tenants may include one)
  // Otherwise fall back to email+name heuristics
  if (person?.Id) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('buildium_contact_id', person.Id)
      .single()
    if (data?.id) return data.id
  }

  if (person?.Email) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('primary_email', person.Email)
      .single()
    if (data?.id) return data.id
  }

  // Create minimal contact
  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      is_company: false,
      first_name: person?.FirstName ?? null,
      last_name: person?.LastName ?? null,
      primary_email: person?.Email ?? null,
      primary_phone: person?.PhoneNumbers?.Mobile || person?.PhoneNumbers?.Home || person?.PhoneNumbers?.Work || null,
      date_of_birth: person?.DateOfBirth ?? null,
      display_name: [person?.FirstName, person?.LastName].filter(Boolean).join(' ') || person?.Email || 'Tenant',
      created_at: now,
      updated_at: now,
      buildium_contact_id: person?.Id ?? null
    })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

async function findOrCreateTenantFromContact(contactId: number, person: BuildiumLeasePerson, supabase: any): Promise<string> {
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('contact_id', contactId)
    .single()
  if (existing?.id) return existing.id

  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('tenants')
    .insert({
      contact_id: contactId,
      comment: person?.Comment ?? null,
      tax_id: person?.TaxId ?? null,
      sms_opt_in_status: typeof person?.SMSOptInStatus === 'boolean' ? String(person.SMSOptInStatus) : null,
      emergency_contact_name: person?.EmergencyContact?.Name ?? null,
      emergency_contact_relationship: person?.EmergencyContact?.RelationshipDescription ?? null,
      emergency_contact_phone: person?.EmergencyContact?.Phone ?? null,
      emergency_contact_email: person?.EmergencyContact?.Email ?? null,
      created_at: now,
      updated_at: now
    })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

async function ensureLeaseContact(leaseId: number, tenantId: string, role: string, supabase: any): Promise<void> {
  const { data: existing } = await supabase
    .from('lease_contacts')
    .select('id')
    .eq('lease_id', leaseId)
    .eq('tenant_id', tenantId)
    .eq('role', role)
    .maybeSingle()
  if (existing?.id) return
  const now = new Date().toISOString()
  await supabase
    .from('lease_contacts')
    .insert({ lease_id: leaseId, tenant_id: tenantId, role, status: 'Active', created_at: now, updated_at: now })
}

async function upsertLeaseWithParties(lease: BuildiumLease, supabase: any): Promise<number> {
  const leaseId = await upsertLeaseFromBuildium(lease, supabase)
  // Tenants
  for (const t of lease.Tenants || []) {
    try {
      const contactId = await findOrCreateContactForLeasePerson(t, supabase)
      const tenantId = await findOrCreateTenantFromContact(contactId, t, supabase)
      await ensureLeaseContact(leaseId, tenantId, 'Tenant', supabase)
    } catch (_) { /* skip problematic tenant */ }
  }
  // Cosigners
  for (const c of lease.Cosigners || []) {
    try {
      const contactId = await findOrCreateContactForLeasePerson(c, supabase)
      const tenantId = await findOrCreateTenantFromContact(contactId, c, supabase)
      await ensureLeaseContact(leaseId, tenantId, 'Guarantor', supabase)
    } catch (_) { /* skip problematic cosigner */ }
  }
  return leaseId
}

// ---------- Tenant mapping helpers ----------
function normalizePhoneFromTenant(tenant: any): { primary?: string; alt?: string } {
  // Buildium may return PhoneNumbers as object {Home,Work,Mobile} or as array [{Type, Number}]
  const phones: any = tenant?.PhoneNumbers || {}
  let home = '', work = '', mobile = ''
  if (Array.isArray(phones)) {
    mobile = phones.find((p: any) => /cell|mobile/i.test(String(p?.Type)))?.Number || ''
    home = phones.find((p: any) => /home/i.test(String(p?.Type)))?.Number || ''
    work = phones.find((p: any) => /work/i.test(String(p?.Type)))?.Number || ''
  } else if (phones && typeof phones === 'object') {
    mobile = phones.Mobile || ''
    home = phones.Home || ''
    work = phones.Work || ''
  }
  const primary = mobile || home || ''
  const alt = work || home || ''
  return { primary, alt }
}

function mapTenantToContactRow(tenant: any) {
  const { primary, alt } = normalizePhoneFromTenant(tenant)
  const primaryAddr = tenant.PrimaryAddress || tenant.Address || {}
  const altAddr = tenant.AlternateAddress || {}
  const dob = tenant?.DateOfBirth ? new Date(tenant.DateOfBirth).toISOString().split('T')[0] : null
  return {
    is_company: !!tenant?.IsCompany,
    first_name: tenant?.FirstName || null,
    last_name: tenant?.LastName || null,
    company_name: tenant?.CompanyName || null,
    primary_email: tenant?.Email || null,
    alt_email: tenant?.AlternateEmail || null,
    primary_phone: primary || null,
    alt_phone: alt || null,
    date_of_birth: dob,
    primary_address_line_1: primaryAddr?.AddressLine1 || null,
    primary_address_line_2: primaryAddr?.AddressLine2 || null,
    primary_address_line_3: primaryAddr?.AddressLine3 || null,
    primary_city: primaryAddr?.City || null,
    primary_state: primaryAddr?.State || null,
    primary_postal_code: primaryAddr?.PostalCode || null,
    primary_country: primaryAddr?.Country || null,
    alt_address_line_1: altAddr?.AddressLine1 || null,
    alt_address_line_2: altAddr?.AddressLine2 || null,
    alt_address_line_3: altAddr?.AddressLine3 || null,
    alt_city: altAddr?.City || null,
    alt_state: altAddr?.State || null,
    alt_postal_code: altAddr?.PostalCode || null,
    alt_country: altAddr?.Country || null,
    mailing_preference: tenant?.MailingPreference === 'AlternateAddress' ? 'alternate' : 'primary',
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

function mapTenantToTenantRow(tenant: any) {
  return {
    buildium_tenant_id: Number(tenant?.Id) || null,
    emergency_contact_name: tenant?.EmergencyContact?.Name || null,
    emergency_contact_relationship: tenant?.EmergencyContact?.RelationshipDescription || null,
    emergency_contact_phone: tenant?.EmergencyContact?.Phone || null,
    emergency_contact_email: tenant?.EmergencyContact?.Email || null,
    sms_opt_in_status: typeof tenant?.SMSOptInStatus === 'boolean' ? tenant.SMSOptInStatus : null,
    comment: tenant?.Comment || null,
    tax_id: tenant?.TaxId || null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

async function findOrCreateContactForTenant(supabase: any, tenant: any): Promise<number> {
  const email = tenant?.Email || tenant?.AlternateEmail || null
  let existing: any = null
  if (email) {
    const { data } = await supabase.from('contacts').select('*').eq('primary_email', email).single()
    existing = data
  }
  if (existing) {
    const update = mapTenantToContactRow(tenant)
    // only set fields that are currently null
    const patch: any = {}
    for (const [k,v] of Object.entries(update)) if (v != null && (existing as any)[k] == null) patch[k] = v
    if (Object.keys(patch).length) await supabase.from('contacts').update(patch).eq('id', existing.id)
    return existing.id
  }
  const insert = mapTenantToContactRow(tenant)
  const { data: created, error } = await supabase.from('contacts').insert(insert).select('id').single()
  if (error) throw error
  return created.id
}

async function findOrCreateTenantRow(supabase: any, contactId: number, tenant: any): Promise<string> {
  const buildiumId = Number(tenant?.Id)
  const { data: existing, error: findErr } = await supabase
    .from('tenants').select('*').eq('buildium_tenant_id', buildiumId).single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr
  if (existing) {
    const update = mapTenantToTenantRow(tenant)
    const patch: any = {}
    for (const [k,v] of Object.entries(update)) if (v != null && (existing as any)[k] == null) patch[k] = v
    if (Object.keys(patch).length) await supabase.from('tenants').update(patch).eq('id', existing.id)
    return existing.id
  }
  const insert = { ...mapTenantToTenantRow(tenant), contact_id: contactId }
  const { data: created, error } = await supabase.from('tenants').insert(insert).select('id').single()
  if (error) throw error
  return created.id
}

async function resolveLocalTenantIdByBuildiumId(supabase: any, buildiumTenantId: number | null): Promise<string | null> {
  if (!buildiumTenantId) return null
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('buildium_tenant_id', buildiumTenantId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

function mapTenantNoteToRow(note: any, buildiumTenantId: number, tenantId: string | null) {
  return {
    tenant_id: tenantId,
    buildium_tenant_id: buildiumTenantId,
    buildium_note_id: Number(note?.Id) || null,
    subject: note?.Subject ?? null,
    note: note?.Note ?? null,
    buildium_created_at: note?.CreatedDateTime ? new Date(note.CreatedDateTime).toISOString() : null,
    buildium_updated_at: note?.LastUpdatedDateTime ? new Date(note.LastUpdatedDateTime).toISOString() : null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

// ---------- Helpers for GL ingest ----------
async function getCursor(supabase: any, key: string) {
  const { data, error } = await supabase
    .from('gl_import_cursors')
    .select('*')
    .eq('key', key)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data as { key: string; last_imported_at: string; window_days: number } | null
}

async function setCursor(supabase: any, key: string, lastImportedAt: string, windowDays?: number) {
  const now = new Date().toISOString()
  const payload: any = { key, last_imported_at: lastImportedAt, updated_at: now }
  if (typeof windowDays === 'number') payload.window_days = windowDays
  const { error } = await supabase
    .from('gl_import_cursors')
    .upsert(payload, { onConflict: 'key' })
  if (error) throw error
}

async function resolveLocalPropertyId(supabase: any, buildiumPropertyId: number | null | undefined): Promise<string | null> {
  if (!buildiumPropertyId) return null
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveLocalUnitId(supabase: any, buildiumUnitId: number | null | undefined): Promise<string | null> {
  if (!buildiumUnitId) return null
  const { data, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

async function resolveLocalLeaseId(supabase: any, buildiumLeaseId: number | null | undefined): Promise<number | null> {
  if (!buildiumLeaseId) return null
  const { data, error } = await supabase
    .from('lease')
    .select('id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.id ?? null
}

function normalizeDate(d?: string | null): string | null {
  if (!d) return null
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0,10)
}

async function upsertLeaseTransactionWithLines(
  supabase: any,
  buildiumClient: any,
  leaseTx: BuildiumLeaseTransaction
): Promise<string> {
  const now = new Date().toISOString()
  const transactionHeader = {
    buildium_transaction_id: leaseTx.Id,
    date: normalizeDate(leaseTx.Date),
    transaction_type: leaseTx.TransactionType || 'Lease',
    total_amount: typeof leaseTx.TotalAmount === 'number' ? leaseTx.TotalAmount : 0,
    check_number: leaseTx.CheckNumber ?? null,
    buildium_lease_id: leaseTx.LeaseId ?? null,
    memo: leaseTx?.Journal?.Memo ?? null,
    payment_method: leaseTx.PaymentMethod ?? null,
    updated_at: now
  }

  // upsert transaction header
  let existing: any = null
  {
    const { data, error } = await supabase
      .from('transactions')
      .select('id')
      .eq('buildium_transaction_id', leaseTx.Id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    existing = data ?? null
  }
  const leaseIdLocal = await resolveLocalLeaseId(supabase, leaseTx.LeaseId ?? null)
  let transactionId: string
  if (existing?.id) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ ...transactionHeader, lease_id: leaseIdLocal })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...transactionHeader, lease_id: leaseIdLocal, created_at: now })
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  // replace lines
  await supabase.from('transaction_lines').delete().eq('transaction_id', transactionId)

  let debit = 0, credit = 0
  const lines = leaseTx?.Journal?.Lines || []
  for (const line of lines) {
    const amount = Number(line?.Amount ?? 0)
    const posting = amount >= 0 ? 'Credit' : 'Debit'
    const glBuildiumId = (line as any)?.GLAccount?.Id
    const glId = await resolveGLAccountId(supabase, buildiumClient, glBuildiumId)
    if (!glId) throw new Error(`GL account not found for line. BuildiumId=${glBuildiumId}`)

    const propertyIdLocal = await resolveLocalPropertyId(supabase, line?.PropertyId ?? null)
    const unitIdLocal = await resolveLocalUnitId(supabase, line?.UnitId ?? null)

    await supabase.from('transaction_lines').insert({
      transaction_id: transactionId,
      gl_account_id: glId,
      amount: Math.abs(amount),
      posting_type: posting,
      memo: line?.Memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: line?.PropertyId ?? null,
      date: normalizeDate(leaseTx.Date),
      created_at: now,
      updated_at: now,
      buildium_property_id: line?.PropertyId ?? null,
      buildium_unit_id: line?.UnitId ?? null,
      buildium_lease_id: leaseTx.LeaseId ?? null,
      property_id: propertyIdLocal,
      unit_id: unitIdLocal
    })

    if (posting === 'Debit') debit += Math.abs(amount)
    else credit += Math.abs(amount)
  }

  if (debit > 0 && credit > 0 && Math.abs(debit - credit) > 0.0001) {
    throw new Error(`Double-entry integrity violation: debits (${debit}) != credits (${credit})`)
  }

  return transactionId
}

async function resolveGLAccountId(
  supabase: any,
  buildiumClient: BuildiumClient,
  buildiumGLAccountId: number | null | undefined
): Promise<string | null> {
  if (!buildiumGLAccountId) return null

  const { data: existing, error: findErr } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', buildiumGLAccountId)
    .single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr
  if (existing) return existing.id

  // fetch from Buildium and insert
  const remote = await buildiumClient.getGLAccount(buildiumGLAccountId)
  const now = new Date().toISOString()
  const row = {
    buildium_gl_account_id: remote.Id,
    account_number: remote.AccountNumber ?? null,
    name: remote.Name,
    description: remote.Description ?? null,
    type: remote.Type,
    sub_type: remote.SubType ?? null,
    is_default_gl_account: !!remote.IsDefaultGLAccount,
    default_account_name: remote.DefaultAccountName ?? null,
    is_contra_account: !!remote.IsContraAccount,
    is_bank_account: !!remote.IsBankAccount,
    cash_flow_classification: remote.CashFlowClassification ?? null,
    exclude_from_cash_balances: !!remote.ExcludeFromCashBalances,
    is_active: remote.IsActive ?? true,
    buildium_parent_gl_account_id: remote.ParentGLAccountId ?? null,
    is_credit_card_account: !!remote.IsCreditCardAccount,
    sub_accounts: null,
    created_at: now,
    updated_at: now
  }
  const { data: inserted, error: insErr } = await supabase
    .from('gl_accounts')
    .insert(row)
    .select('id')
    .single()
  if (insErr) throw insErr
  return inserted.id
}

function normalizeDate(input: string | null | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10)
  return input.slice(0, 10)
}

async function upsertGLEntry(
  supabase: any,
  buildiumClient: BuildiumClient,
  entry: any
) {
  const now = new Date().toISOString()
  const header = {
    buildium_transaction_id: entry?.Id ?? null,
    date: normalizeDate(entry?.Date),
    total_amount: Array.isArray(entry?.Lines) ? entry.Lines.reduce((s: number, l: any) => s + Math.abs(Number(l?.Amount || 0)), 0) : 0,
    check_number: entry?.CheckNumber ?? null,
    memo: entry?.Memo ?? null,
    transaction_type: 'JournalEntry' as const,
    updated_at: now
  }

  // upsert header into transactions
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', header.buildium_transaction_id)
    .single()
  if (findErr && findErr.code !== 'PGRST116') throw findErr

  let transactionId: string
  if (existing) {
    const { data, error } = await supabase
      .from('transactions')
      .update(header)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...header, created_at: now })
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  // replace lines
  await supabase.from('transaction_lines').delete().eq('transaction_id', transactionId)

  let debit = 0
  let credit = 0
  const pending: any[] = []
  for (const line of (entry?.Lines || [])) {
    const amount = Number(line?.Amount || 0)
    const posting: 'Debit' | 'Credit' = line?.PostingType === 'Debit' || line?.PostingType === 'Credit'
      ? line.PostingType
      : (amount >= 0 ? 'Credit' : 'Debit')

    if (!line?.AccountingEntity || !line?.AccountingEntity?.AccountingEntityType) {
      throw new Error('AccountingEntity with AccountingEntityType is required for GL entry lines')
    }

    const glAccountId = await resolveGLAccountId(supabase, buildiumClient, line?.GLAccountId ?? line?.GLAccount?.Id)
    if (!glAccountId) throw new Error('Unable to resolve GL account id')

    const buildiumPropertyId = line?.AccountingEntity?.Id ?? null
    const buildiumUnitId = line?.AccountingEntity?.UnitId ?? null
    const propId = await resolveLocalPropertyId(supabase, buildiumPropertyId)
    const unitId = await resolveLocalUnitId(supabase, buildiumUnitId)

    pending.push({
      transaction_id: transactionId,
      gl_account_id: glAccountId,
      amount: Math.abs(amount),
      posting_type: posting,
      memo: line?.Memo ?? null,
      account_entity_type: String(line?.AccountingEntity?.AccountingEntityType).toLowerCase() === 'rental' ? 'Rental' : 'Company',
      account_entity_id: buildiumPropertyId ?? null,
      date: normalizeDate(entry?.Date),
      created_at: now,
      updated_at: now,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: null,
      property_id: propId,
      unit_id: unitId
    })

    if (posting === 'Debit') debit += Math.abs(amount)
    else credit += Math.abs(amount)
  }

  if (pending.length > 0) {
    const { error } = await supabase.from('transaction_lines').insert(pending)
    if (error) throw error
  }

  if (Math.abs(debit - credit) > 0.0001) {
    throw new Error(`Double-entry integrity violation: debits (${debit}) != credits (${credit})`)
  }

  // journal_entries header upsert
  const je = {
    buildium_gl_entry_id: entry?.Id ?? null,
    transaction_id: transactionId,
    date: normalizeDate(entry?.Date),
    memo: entry?.Memo ?? null,
    check_number: entry?.CheckNumber ?? null,
    total_amount: pending.reduce((s, l) => s + Number(l.amount || 0), 0),
    updated_at: now
  }
  const { data: existingJE, error: findJe } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('buildium_gl_entry_id', je.buildium_gl_entry_id)
    .single()
  if (findJe && findJe.code !== 'PGRST116') throw findJe
  if (existingJE) {
    const { error } = await supabase.from('journal_entries').update(je).eq('id', existingJE.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('journal_entries').insert({ ...je, created_at: now })
    if (error) throw error
  }
}

// ------- Work Order helpers (mapping + resolvers) -------
function mapWorkOrderPriorityFromBuildium(p?: string | null): string | null {
  if (!p) return null
  const v = String(p)
  if (/^low$/i.test(v)) return 'low'
  if (/^medium$/i.test(v)) return 'medium'
  if (/^high$/i.test(v)) return 'high'
  if (/^urgent$/i.test(v)) return 'urgent'
  return v.toLowerCase()
}
function mapWorkOrderStatusFromBuildium(s?: string | null): string | null {
  if (!s) return null
  const v = String(s)
  if (/^new$/i.test(v)) return 'open'
  if (/^inprogress$/i.test(v)) return 'in_progress'
  if (/^completed$/i.test(v)) return 'completed'
  if (/^cancelled$/i.test(v)) return 'cancelled'
  return v.toLowerCase()
}
function mapPriorityToBuildium(p?: string | null): 'Low' | 'Medium' | 'High' | 'Urgent' | undefined {
  if (!p) return undefined
  const v = String(p).toLowerCase()
  if (v === 'low') return 'Low'
  if (v === 'medium') return 'Medium'
  if (v === 'high') return 'High'
  if (v === 'urgent') return 'Urgent'
  return undefined
}
function mapStatusToBuildium(s?: string | null): 'New' | 'InProgress' | 'Completed' | 'Cancelled' | undefined {
  if (!s) return undefined
  const v = String(s).toLowerCase()
  if (v === 'open' || v === 'new') return 'New'
  if (v === 'in_progress') return 'InProgress'
  if (v === 'completed') return 'Completed'
  if (v === 'cancelled') return 'Cancelled'
  return undefined
}

async function resolveLocalPropertyIdByBuildiumId(supabase: any, buildiumId?: number | null): Promise<string | null> {
  if (!buildiumId) return null
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumId)
    .single()
  return data?.id ?? null
}
async function resolveLocalUnitIdByBuildiumId(supabase: any, buildiumId?: number | null): Promise<string | null> {
  if (!buildiumId) return null
  const { data } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumId)
    .single()
  return data?.id ?? null
}
async function resolveBuildiumPropertyIdByLocalId(supabase: any, localId?: string | null): Promise<number | null> {
  if (!localId) return null
  const { data } = await supabase
    .from('properties')
    .select('buildium_property_id')
    .eq('id', localId)
    .single()
  return data?.buildium_property_id ?? null
}
async function resolveBuildiumUnitIdByLocalId(supabase: any, localId?: string | null): Promise<number | null> {
  if (!localId) return null
  const { data } = await supabase
    .from('units')
    .select('buildium_unit_id')
    .eq('id', localId)
    .single()
  return data?.buildium_unit_id ?? null
}

async function mapWorkOrderFromBuildium(wo: BuildiumWorkOrder, supabase: any): Promise<any> {
  const subject = wo.Subject || wo.Title || ''
  const propertyId = await resolveLocalPropertyIdByBuildiumId(supabase, wo.Property?.Id)
  const unitId = await resolveLocalUnitIdByBuildiumId(supabase, wo.UnitId ?? null)
  return {
    buildium_work_order_id: wo.Id,
    subject,
    description: wo.Description ?? null,
    priority: mapWorkOrderPriorityFromBuildium(wo.Priority),
    status: mapWorkOrderStatusFromBuildium(wo.WorkOrderStatus),
    assigned_to: wo.AssignedToUserId ? String(wo.AssignedToUserId) : null,
    estimated_cost: null,
    actual_cost: null,
    scheduled_date: wo.DueDate ? new Date(wo.DueDate).toISOString() : null,
    completed_date: null,
    category: wo.Category?.Name ?? null,
    notes: null,
    property_id: propertyId,
    unit_id: unitId,
    updated_at: wo.LastUpdatedDateTime || new Date().toISOString(),
    created_at: wo.CreatedDateTime || new Date().toISOString()
  }
}

async function toBuildiumWorkOrder(payload: any, supabase: any): Promise<any> {
  const buildiumPropertyId = payload.PropertyId || await resolveBuildiumPropertyIdByLocalId(supabase, payload.property_id)
  const buildiumUnitId = payload.UnitId || await resolveBuildiumUnitIdByLocalId(supabase, payload.unit_id)
  const body: any = {
    PropertyId: buildiumPropertyId,
    UnitId: buildiumUnitId || undefined,
    Subject: payload.Subject || payload.subject || payload.Title,
    Title: payload.Title || payload.Subject || payload.subject,
    Description: payload.Description || payload.description,
    Priority: payload.Priority || mapPriorityToBuildium(payload.priority),
    DueDate: payload.DueDate || payload.due_date || payload.scheduled_date || undefined,
    Category: payload.Category || payload.category,
    Notes: payload.Notes || payload.notes,
    EstimatedCost: payload.EstimatedCost || payload.estimated_cost,
    ScheduledDate: payload.ScheduledDate || payload.scheduled_date
  }
  const status = payload.WorkOrderStatus || mapStatusToBuildium(payload.status)
  if (status) body.WorkOrderStatus = status
  if (payload.ActualCost || payload.actual_cost) body.ActualCost = payload.ActualCost || payload.actual_cost
  if (payload.CompletedDate || payload.completed_date) body.CompletedDate = payload.CompletedDate || payload.completed_date
  return sanitizeForBuildium(body)
}

// Main handler
serve(async (req) => {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Buildium client
    const buildiumClient = new BuildiumClient({
      baseUrl: Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1',
      clientId: Deno.env.get('BUILDIUM_CLIENT_ID') || '',
      clientSecret: Deno.env.get('BUILDIUM_CLIENT_SECRET') || '',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    })

  const { method } = req
  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

    if (method === 'POST') {
      const body = await req.json()
      const { entityType, entityData, operation } = body

      // Support POST with body.method === 'GET' to match existing client usage
      if ((body?.method === 'GET' || body?.method === 'get') && entityType) {
        let result: any
        const params = (body?.params || {}) as Record<string, string | number | boolean>
        if (body?.entityId) {
          const idNum = parseInt(String(body.entityId))
          if (entityType === 'bankAccount') result = await buildiumClient.getBankAccount(idNum)
          else if (entityType === 'property') result = await buildiumClient.getProperty(idNum)
          else if (entityType === 'owner') result = await buildiumClient.getOwner(idNum)
          else if (entityType === 'glAccount') result = await buildiumClient.getGLAccount(idNum)
          else if (entityType === 'glEntry') result = await buildiumClient.getGLEntry(idNum)
          else if (entityType === 'glTransaction') result = await buildiumClient.makeRequest<any>('GET', `/gltransactions/${idNum}`)
          else if (entityType === 'glAccountBalance') result = await buildiumClient.getGLAccountBalance(idNum, String(body?.asOfDate || ''))
          else if (entityType === 'tenant') result = await buildiumClient.getTenant(idNum)
          else throw new Error(`Unsupported entity type for GET: ${entityType}`)
        } else {
          // collection/list
          if (entityType === 'glAccounts') result = await buildiumClient.listGLAccounts(params)
          else if (entityType === 'glEntries') result = await buildiumClient.listGLEntries(params)
          else if (entityType === 'glTransactions' || entityType === 'glTransaction') result = await buildiumClient.listGLTransactions(params)
          else throw new Error(`Unsupported list type for GET: ${entityType}`)
        }
        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }

      let result: any

      switch (entityType) {
        case 'sync': {
          if (operation !== 'orchestrate') throw new Error('Unsupported sync operation')
          const p = entityData || {}
          const propertyIds: number[] = Array.isArray(p.propertyids) ? p.propertyids.map((x:any)=>Number(x)) : []
          const limit = p.limit ? Number(p.limit) : 100
          const offset = p.offset ? Number(p.offset) : 0
          const includeLeaseTransactions = !!p.includeLeaseTransactions

          const result: any = { properties: 0, unitsFetched: 0, leasesUpserted: 0, failures: 0 }
          let propIds: number[] = propertyIds
          if (propIds.length === 0) {
            try {
              const props = await buildiumClient.listProperties({ limit, offset })
              propIds = (props || []).map((x:any)=>Number(x?.Id)).filter(Boolean)
              result.properties = propIds.length
            } catch (_) {}
          } else {
            result.properties = propIds.length
          }

          // Optionally prefetch units (no persistence here; assumes separate unit sync)
          try {
            for (const pid of propIds) {
              const us = await buildiumClient.getUnits(pid)
              result.unitsFetched += Array.isArray(us) ? us.length : 0
            }
          } catch (_) {}

          // Fetch leases limited by property ids and upsert
          try {
            const leaseParams: any = { limit, offset }
            if (propIds.length) leaseParams.propertyids = propIds
            const leases = await buildiumClient.listLeases(leaseParams)
            for (const l of leases || []) {
              try {
                const localLeaseId = await upsertLeaseWithParties(l, supabase)
                result.leasesUpserted++
                if (includeLeaseTransactions) {
                  const txs = await buildiumClient.listLeaseTransactions(l.Id, { limit: 200 })
                  for (const tx of txs || []) {
                    try { await upsertLeaseTransactionWithLines(supabase, buildiumClient, tx) } catch (_) { result.failures++ }
                  }
                }
              } catch (_) { result.failures++ }
            }
          } catch (_) {}

          return new Response(JSON.stringify({ success: true, ...result }), { headers: { 'Content-Type': 'application/json' } })
        }
        case 'leaseNote': {
          const leaseId = Number(entityData?.leaseId || entityData?.LeaseId || entityData?.id)
          if (!leaseId) throw new Error('leaseId required for leaseNote operations')
          if (operation === 'list') {
            const params = (entityData || {})
            const items = await buildiumClient.listLeaseNotes(leaseId, params)
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const noteId = Number(entityData?.noteId || entityData?.Id)
            const item = await buildiumClient.getLeaseNote(leaseId, noteId)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'create') {
            const payload = sanitizeForBuildium(entityData || {})
            const created = await buildiumClient.createLeaseNote(leaseId, payload)
            // persist
            try {
              const { data: localLease } = await supabase.from('lease').select('id').eq('buildium_lease_id', leaseId).single()
              if (localLease?.id) {
                const row = {
                  lease_id: localLease.id,
                  buildium_lease_id: leaseId,
                  buildium_note_id: created?.Id ?? null,
                  subject: created?.Subject ?? null,
                  body: created?.Body ?? null,
                  is_private: created?.IsPrivate ?? null,
                  updated_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
                }
                await supabase.from('lease_notes').insert(row)
              }
            } catch (_) {}
            return new Response(JSON.stringify({ success: true, data: created }), { headers: { 'Content-Type': 'application/json' }, status: 201 })
          } else if (operation === 'update') {
            const noteId = Number(entityData?.noteId || entityData?.Id)
            const payload = sanitizeForBuildium(entityData || {})
            const updated = await buildiumClient.updateLeaseNote(leaseId, noteId, payload)
            try {
              const { data: localLease } = await supabase.from('lease').select('id').eq('buildium_lease_id', leaseId).single()
              if (localLease?.id) {
                const row = {
                  subject: updated?.Subject ?? null,
                  body: updated?.Body ?? null,
                  is_private: updated?.IsPrivate ?? null,
                  updated_at: new Date().toISOString()
                }
                await supabase
                  .from('lease_notes')
                  .update(row)
                  .eq('lease_id', localLease.id)
                  .eq('buildium_note_id', noteId)
              }
            } catch (_) {}
            return new Response(JSON.stringify({ success: true, data: updated }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for leaseNote: ${operation}`)
          }
        }
        case 'leaseRecurring': {
          const leaseId = Number(entityData?.leaseId || entityData?.LeaseId || entityData?.id)
          if (!leaseId) throw new Error('leaseId required for leaseRecurring operations')
          if (operation === 'list') {
            const params = (entityData || {})
            const items = await buildiumClient.listLeaseRecurring(leaseId, params)
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const recurringId = Number(entityData?.recurringId || entityData?.Id)
            const item = await buildiumClient.getLeaseRecurring(leaseId, recurringId)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'create') {
            const payload = sanitizeForBuildium(entityData || {})
            const created = await buildiumClient.createLeaseRecurring(leaseId, payload)
            try {
              const { data: localLease } = await supabase.from('lease').select('id').eq('buildium_lease_id', leaseId).single()
              if (localLease?.id) {
                const row = {
                  lease_id: localLease.id,
                  buildium_lease_id: leaseId,
                  buildium_recurring_id: created?.Id ?? null,
                  amount: created?.Amount ?? null,
                  description: created?.Description ?? null,
                  frequency: created?.Frequency ?? null,
                  start_date: created?.StartDate ?? null,
                  end_date: created?.EndDate ?? null,
                  updated_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                }
                await supabase.from('lease_recurring_transactions').insert(row)
              }
            } catch (_) {}
            return new Response(JSON.stringify({ success: true, data: created }), { headers: { 'Content-Type': 'application/json' }, status: 201 })
          } else if (operation === 'update') {
            const recurringId = Number(entityData?.recurringId || entityData?.Id)
            const payload = sanitizeForBuildium(entityData || {})
            const updated = await buildiumClient.updateLeaseRecurring(leaseId, recurringId, payload)
            try {
              const { data: localLease } = await supabase.from('lease').select('id').eq('buildium_lease_id', leaseId).single()
              if (localLease?.id) {
                const row = {
                  amount: updated?.Amount ?? null,
                  description: updated?.Description ?? null,
                  frequency: updated?.Frequency ?? null,
                  start_date: updated?.StartDate ?? null,
                  end_date: updated?.EndDate ?? null,
                  updated_at: new Date().toISOString(),
                }
                await supabase
                  .from('lease_recurring_transactions')
                  .update(row)
                  .eq('lease_id', localLease.id)
                  .eq('buildium_recurring_id', recurringId)
              }
            } catch (_) {}
            return new Response(JSON.stringify({ success: true, data: updated }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'delete') {
            const recurringId = Number(entityData?.recurringId || entityData?.Id)
            await buildiumClient.deleteLeaseRecurring(leaseId, recurringId)
            try {
              const { data: localLease } = await supabase.from('lease').select('id').eq('buildium_lease_id', leaseId).single()
              if (localLease?.id) {
                await supabase
                  .from('lease_recurring_transactions')
                  .delete()
                  .eq('lease_id', localLease.id)
                  .eq('buildium_recurring_id', recurringId)
              }
            } catch (_) {}
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for leaseRecurring: ${operation}`)
          }
        }
        case 'leaseMoveOut': {
          const leaseId = Number(entityData?.leaseId || entityData?.LeaseId || entityData?.id)
          if (!leaseId) throw new Error('leaseId required for leaseMoveOut operations')
          if (operation === 'list') {
            const params = (entityData || {})
            const items = await buildiumClient.listLeaseMoveOuts(leaseId, params)
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const moveOutId = Number(entityData?.moveOutId || entityData?.Id)
            const item = await buildiumClient.getLeaseMoveOut(leaseId, moveOutId)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'create') {
            const payload = sanitizeForBuildium(entityData || {})
            const created = await buildiumClient.createLeaseMoveOut(leaseId, payload)
            return new Response(JSON.stringify({ success: true, data: created }), { headers: { 'Content-Type': 'application/json' }, status: 201 })
          } else if (operation === 'delete') {
            const moveOutId = Number(entityData?.moveOutId || entityData?.Id)
            await buildiumClient.deleteLeaseMoveOut(leaseId, moveOutId)
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for leaseMoveOut: ${operation}`)
          }
        }
        case 'lease': {
          if (operation === 'create') {
            const payload = sanitizeForBuildium(entityData || {})
            const created = await buildiumClient.createLease(payload)
            const leaseLocalId = await upsertLeaseWithParties(created, supabase)
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'lease',
              p_entity_id: String(leaseLocalId),
              p_buildium_id: created.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: created }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'update') {
            const id = Number(entityData?.Id || entityData?.buildium_lease_id)
            if (!id) throw new Error('buildium_lease_id (or Id) is required for lease update')
            const payload = sanitizeForBuildium(entityData || {})
            const updated = await buildiumClient.updateLease(id, payload)
            const leaseLocalId = await upsertLeaseWithParties(updated, supabase)
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'lease',
              p_entity_id: String(leaseLocalId),
              p_buildium_id: updated.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: updated }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'list') {
            const params = entityData || {}
            const data = await buildiumClient.listLeases(params)
            return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncFromBuildium') {
            const params = entityData || {}
            const remotes = await buildiumClient.listLeases(params)
            let synced = 0, updated = 0, failed = 0
            for (const l of remotes) {
              try {
                const { data: existing } = await supabase
                  .from('lease')
                  .select('id')
                  .eq('buildium_lease_id', l.Id)
                  .single()
                const id = await upsertLeaseWithParties(l, supabase)
                if (existing?.id) updated++
                else synced++
                await supabase.rpc('update_buildium_sync_status', {
                  p_entity_type: 'lease',
                  p_entity_id: String(id),
                  p_buildium_id: l.Id,
                  p_status: 'synced'
                }).catch(()=>{})
              } catch (e) { failed++ }
            }
            return new Response(JSON.stringify({ success: true, synced, updated, failed, count: remotes.length }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const id = Number(entityData?.Id || entityData?.id || entityData?.buildium_lease_id)
            const item = await buildiumClient.getLease(id)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncOneFromBuildium') {
            const id = Number(entityData?.Id || entityData?.id || entityData?.buildium_lease_id)
            if (!id) throw new Error('Id required for lease syncOneFromBuildium')
            const lease = await buildiumClient.getLease(id)
            const leaseLocalId = await upsertLeaseWithParties(lease, supabase)
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'lease',
              p_entity_id: String(leaseLocalId),
              p_buildium_id: lease.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: lease, localId: leaseLocalId }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for lease: ${operation}`)
          }
        }
        case 'leaseTransaction': {
          const leaseId = Number(entityData?.leaseId || entityData?.LeaseId || entityData?.id)
          if (!leaseId) throw new Error('leaseId required for leaseTransaction operations')
          if (operation === 'list') {
            const params = (entityData || {}) as Record<string,string|number|boolean>
            const items = await buildiumClient.listLeaseTransactions(leaseId, params)
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const transactionId = Number(entityData?.transactionId || entityData?.Id)
            const item = await buildiumClient.getLeaseTransaction(leaseId, transactionId)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncFromBuildiumOne') {
            const transactionId = Number(entityData?.transactionId || entityData?.Id)
            const item = await buildiumClient.getLeaseTransaction(leaseId, transactionId)
            const tid = await upsertLeaseTransactionWithLines(supabase, buildiumClient, item)
            return new Response(JSON.stringify({ success: true, transactionId: tid }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncFromBuildium') {
            const params = (entityData || {}) as Record<string,string|number|boolean>
            const items = await buildiumClient.listLeaseTransactions(leaseId, params)
            let upserted = 0, failed = 0
            for (const t of items || []) {
              try { await upsertLeaseTransactionWithLines(supabase, buildiumClient, t); upserted++ } catch (_) { failed++ }
            }
            return new Response(JSON.stringify({ success: true, upserted, failed, count: items?.length || 0 }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for leaseTransaction: ${operation}`)
          }
        }
        case 'appliance': {
          if (operation === 'create') {
            const buildiumData = await toBuildiumAppliance(entityData, supabase)
            const result = await buildiumClient.createAppliance(sanitizeForBuildium(buildiumData))
            const row = await mapApplianceFromBuildium(result, supabase)
            const { data: existing } = await supabase
              .from('appliances')
              .select('id')
              .eq('buildium_appliance_id', result.Id)
              .single()
            if (existing) {
              await supabase.from('appliances').update(row).eq('id', existing.id)
            } else {
              await supabase.from('appliances').insert(row)
            }
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'appliance',
              p_entity_id: existing?.id || null,
              p_buildium_id: result.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'update') {
            const id = Number(entityData.buildium_appliance_id || entityData.Id)
            const buildiumData = await toBuildiumAppliance(entityData, supabase)
            const result = await buildiumClient.updateAppliance(id, sanitizeForBuildium(buildiumData))
            const row = await mapApplianceFromBuildium(result, supabase)
            const { data: existing } = await supabase
              .from('appliances')
              .select('id')
              .eq('buildium_appliance_id', id)
              .single()
            if (existing) {
              await supabase.from('appliances').update(row).eq('id', existing.id)
            } else {
              await supabase.from('appliances').insert(row)
            }
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'appliance',
              p_entity_id: existing?.id || null,
              p_buildium_id: result.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncFromBuildium' || operation === 'list') {
            const params = entityData || {}
            const items = await buildiumClient.listAppliances(params)
            if (operation === 'syncFromBuildium') {
              let synced = 0, updated = 0, errors: string[] = []
              for (const a of items) {
                try {
                  const row = await mapApplianceFromBuildium(a, supabase)
                  const { data: existing } = await supabase
                    .from('appliances')
                    .select('id')
                    .eq('buildium_appliance_id', a.Id)
                    .single()
                  if (existing) {
                    await supabase.from('appliances').update(row).eq('id', existing.id)
                    updated++
                  } else {
                    await supabase.from('appliances').insert(row)
                    synced++
                  }
                } catch (e) { errors.push((e as Error).message) }
              }
              return new Response(JSON.stringify({ success: true, synced, updated, errors, count: items.length }), { headers: { 'Content-Type': 'application/json' } })
            }
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const id = Number(entityData?.id || entityData?.Id)
            const ap = await buildiumClient.getAppliance(id)
            return new Response(JSON.stringify({ success: true, data: ap }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for appliance: ${operation}`)
          }
        }

        case 'applianceServiceHistory': {
          const applianceId = Number(entityData?.applianceId || entityData?.ApplianceId || entityData?.appliance_id)
          if (!applianceId) throw new Error('applianceId is required for applianceServiceHistory operations')
          if (operation === 'list') {
            const items = await buildiumClient.listApplianceServiceHistory(applianceId, entityData || {})
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const serviceHistoryId = Number(entityData?.serviceHistoryId || entityData?.Id)
            const item = await buildiumClient.getApplianceServiceHistory(applianceId, serviceHistoryId)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'create') {
            const payload = sanitizeForBuildium({
              ServiceDate: entityData.ServiceDate || entityData.serviceDate || entityData.service_date,
              ServiceType: entityData.ServiceType || entityData.serviceType || entityData.service_type,
              Description: entityData.Description || entityData.description,
              Cost: entityData.Cost ?? entityData.cost,
              VendorName: entityData.VendorName || entityData.vendor_name || entityData.vendorName,
              Notes: entityData.Notes || entityData.notes,
            })
            const created = await buildiumClient.createApplianceServiceHistory(applianceId, payload)
            return new Response(JSON.stringify({ success: true, data: created }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'update') {
            const serviceHistoryId = Number(entityData?.serviceHistoryId || entityData?.Id)
            const payload = sanitizeForBuildium({
              ServiceDate: entityData.ServiceDate || entityData.serviceDate || entityData.service_date,
              ServiceType: entityData.ServiceType || entityData.serviceType || entityData.service_type,
              Description: entityData.Description || entityData.description,
              Cost: entityData.Cost ?? entityData.cost,
              VendorName: entityData.VendorName || entityData.vendor_name || entityData.vendorName,
              Notes: entityData.Notes || entityData.notes,
            })
            const updated = await buildiumClient.updateApplianceServiceHistory(applianceId, serviceHistoryId, payload)
            return new Response(JSON.stringify({ success: true, data: updated }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for applianceServiceHistory: ${operation}`)
          }
        }

        case 'tenant': {
          if (operation === 'create') {
            const payload = sanitizeForBuildium(entityData || {})
            const t = await buildiumClient.createTenant(payload)
            try {
              const contactId = await findOrCreateContactForTenant(supabase, t)
              await findOrCreateTenantRow(supabase, contactId, t)
            } catch (_) {}
            return new Response(JSON.stringify({ success: true, data: t }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'update') {
            const id = Number(entityData?.buildium_tenant_id || entityData?.Id)
            if (!id) throw new Error('buildium_tenant_id or Id is required for tenant update')
            const t = await buildiumClient.updateTenant(id, sanitizeForBuildium(entityData))
            try {
              const contactId = await findOrCreateContactForTenant(supabase, t)
              await findOrCreateTenantRow(supabase, contactId, t)
            } catch (_) {}
            return new Response(JSON.stringify({ success: true, data: t }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncFromBuildium' || operation === 'list') {
            const params = entityData || {}
            const items = await buildiumClient.listTenants(params)
            if (operation === 'syncFromBuildium') {
              let synced = 0, updated = 0, errors: string[] = []
              for (const t of items) {
                try {
                  const contactId = await findOrCreateContactForTenant(supabase, t)
                  await findOrCreateTenantRow(supabase, contactId, t)
                  synced++
                } catch (e) {
                  errors.push((e as Error)?.message || 'Unknown error')
                }
              }
              return new Response(JSON.stringify({ success: true, synced, updated, errors, count: items.length }), { headers: { 'Content-Type': 'application/json' } })
            }
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const id = Number(entityData?.buildium_tenant_id || entityData?.Id)
            const t = await buildiumClient.getTenant(id)
            return new Response(JSON.stringify({ success: true, data: t }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for tenant: ${operation}`)
          }
        }

        case 'tenantNote': {
          const buildiumTenantId = Number(entityData?.tenantId || entityData?.TenantId || entityData?.tenant_id)
          if (!buildiumTenantId) throw new Error('tenantId is required for tenantNote operations')

          if (operation === 'list') {
            const items = await buildiumClient.listTenantNotes(buildiumTenantId, entityData || {})
            // Persist to DB
            const localTenantId = await resolveLocalTenantIdByBuildiumId(supabase, buildiumTenantId)
            if (localTenantId) {
              for (const n of (items || [])) {
                const row = mapTenantNoteToRow(n, buildiumTenantId, localTenantId)
                const { data: existing } = await supabase
                  .from('tenant_notes')
                  .select('id')
                  .eq('buildium_tenant_id', buildiumTenantId)
                  .eq('buildium_note_id', row.buildium_note_id)
                  .single()
                if (existing) {
                  await supabase.from('tenant_notes').update(row).eq('id', existing.id)
                } else {
                  await supabase.from('tenant_notes').insert(row)
                }
              }
            }
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'create') {
            const created = await buildiumClient.createTenantNote(buildiumTenantId, sanitizeForBuildium(entityData))
            const localTenantId = await resolveLocalTenantIdByBuildiumId(supabase, buildiumTenantId)
            if (localTenantId) {
              const row = mapTenantNoteToRow(created, buildiumTenantId, localTenantId)
              const { data: existing } = await supabase
                .from('tenant_notes')
                .select('id')
                .eq('buildium_tenant_id', buildiumTenantId)
                .eq('buildium_note_id', row.buildium_note_id)
                .single()
              if (existing) await supabase.from('tenant_notes').update(row).eq('id', existing.id)
              else await supabase.from('tenant_notes').insert(row)
            }
            return new Response(JSON.stringify({ success: true, data: created }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'update') {
            const noteId = Number(entityData?.noteId || entityData?.NoteId || entityData?.note_id)
            if (!noteId) throw new Error('noteId is required for tenantNote update')
            const updated = await buildiumClient.updateTenantNote(buildiumTenantId, noteId, sanitizeForBuildium(entityData))
            const localTenantId = await resolveLocalTenantIdByBuildiumId(supabase, buildiumTenantId)
            if (localTenantId) {
              const row = mapTenantNoteToRow(updated, buildiumTenantId, localTenantId)
              const { data: existing } = await supabase
                .from('tenant_notes')
                .select('id')
                .eq('buildium_tenant_id', buildiumTenantId)
                .eq('buildium_note_id', row.buildium_note_id)
                .single()
              if (existing) await supabase.from('tenant_notes').update(row).eq('id', existing.id)
              else await supabase.from('tenant_notes').insert(row)
            }
            return new Response(JSON.stringify({ success: true, data: updated }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const noteId = Number(entityData?.noteId || entityData?.NoteId || entityData?.note_id)
            if (!noteId) throw new Error('noteId is required for tenantNote get')
            const item = await buildiumClient.getTenantNote(buildiumTenantId, noteId)
            return new Response(JSON.stringify({ success: true, data: item }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for tenantNote: ${operation}`)
          }
        }
        case 'property':
          if (operation === 'create') {
            const buildiumData = mapPropertyToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.createProperty(sanitizedData)
          } else if (operation === 'update') {
            const buildiumData = mapPropertyToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.updateProperty(entityData.buildium_property_id, sanitizedData)
          }
          break

        case 'owner':
          if (operation === 'create') {
            const buildiumData = mapOwnerToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.createOwner(sanitizedData)
          } else if (operation === 'update') {
            const buildiumData = mapOwnerToBuildium(entityData)
            const sanitizedData = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.updateOwner(entityData.buildium_owner_id, sanitizedData)
          } else if (operation === 'list') {
            const { limit = 50, offset = 0, lastupdatedfrom, lastupdatedto, orderby, isActive } = entityData || {}
            const qp: Record<string,string> = { limit: String(limit), offset: String(offset) }
            if (lastupdatedfrom) qp['lastupdatedfrom'] = String(lastupdatedfrom)
            if (lastupdatedto) qp['lastupdatedto'] = String(lastupdatedto)
            if (orderby) qp['orderby'] = String(orderby)
            if (typeof isActive !== 'undefined') qp['isActive'] = String(isActive)
            result = await buildiumClient.listOwners(qp)
          } else if (operation === 'syncFromBuildium') {
            const { limit = 100, offset = 0, lastupdatedfrom, lastupdatedto } = entityData || {}
            const qp: Record<string,string> = { limit: String(limit), offset: String(offset) }
            if (lastupdatedfrom) qp['lastupdatedfrom'] = String(lastupdatedfrom)
            if (lastupdatedto) qp['lastupdatedto'] = String(lastupdatedto)
            const owners = await buildiumClient.listOwners(qp)
            let created = 0, updated = 0
            for (const o of owners || []) {
              try {
                const res = await upsertOwnerFromBuildiumEdge(o, supabase)
                if (res.created) created++; else updated++
              } catch (e) {
                console.warn('Owner upsert failed:', (e as Error)?.message)
              }
            }
            result = { created, updated, count: owners?.length || 0 }
          }
          break

        case 'workOrder': {
          if (operation === 'create') {
            const buildiumData = await toBuildiumWorkOrder(entityData, supabase)
            const result = await buildiumClient.createWorkOrder(buildiumData)
            const row = await mapWorkOrderFromBuildium(result, supabase)
            // upsert by buildium_work_order_id
            const { data: existing } = await supabase
              .from('work_orders')
              .select('id')
              .eq('buildium_work_order_id', result.Id)
              .single()
            if (existing) {
              await supabase.from('work_orders').update(row).eq('id', existing.id)
            } else {
              await supabase.from('work_orders').insert(row)
            }
            // sync status
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'work_order',
              p_entity_id: existing?.id || null,
              p_buildium_id: result.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'update') {
            const buildiumData = await toBuildiumWorkOrder(entityData, supabase)
            const id = entityData.buildium_work_order_id || entityData.Id
            const result = await buildiumClient.updateWorkOrder(Number(id), buildiumData)
            const row = await mapWorkOrderFromBuildium(result, supabase)
            const { data: existing } = await supabase
              .from('work_orders')
              .select('id')
              .eq('buildium_work_order_id', result.Id)
              .single()
            if (existing) {
              await supabase.from('work_orders').update(row).eq('id', existing.id)
            } else {
              await supabase.from('work_orders').insert(row)
            }
            await supabase.rpc('update_buildium_sync_status', {
              p_entity_type: 'work_order',
              p_entity_id: existing?.id || null,
              p_buildium_id: result.Id,
              p_status: 'synced'
            }).catch(()=>{})
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncFromBuildium' || operation === 'list') {
            const params = entityData || {}
            const items = await buildiumClient.listWorkOrders(params)
            if (operation === 'syncFromBuildium') {
              let synced = 0, updated = 0, errors: string[] = []
              for (const wo of items) {
                try {
                  const row = await mapWorkOrderFromBuildium(wo, supabase)
                  const { data: existing } = await supabase
                    .from('work_orders')
                    .select('id')
                    .eq('buildium_work_order_id', wo.Id)
                    .single()
                  if (existing) {
                    await supabase.from('work_orders').update(row).eq('id', existing.id)
                    updated++
                  } else {
                    await supabase.from('work_orders').insert(row)
                    synced++
                  }
                } catch (e) {
                  errors.push((e as Error)?.message || 'Unknown error')
                }
              }
              return new Response(JSON.stringify({ success: true, synced, updated, errors, count: items.length }), { headers: { 'Content-Type': 'application/json' } })
            }
            return new Response(JSON.stringify({ success: true, data: items }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'searchLocal' || operation === 'search') {
            const p = entityData || {}
            const limit = Number(p.limit ?? 50)
            const offset = Number(p.offset ?? 0)
            let query = supabase
              .from('work_orders')
              .select('*', { count: 'exact' })
              .order('updated_at', { ascending: false })
              .range(offset, offset + limit - 1)

            if (p.q) query = query.ilike('subject', `%${p.q}%`)
            if (p.status) query = query.eq('status', p.status)
            if (p.priority) query = query.eq('priority', p.priority)
            if (p.propertyId) query = query.eq('property_id', p.propertyId)
            if (p.unitId) query = query.eq('unit_id', p.unitId)
            if (p.category) query = query.ilike('category', `%${p.category}%`)
            if (p.scheduledFrom) query = query.gte('scheduled_date', p.scheduledFrom)
            if (p.scheduledTo) query = query.lte('scheduled_date', p.scheduledTo)

            const { data, error, count } = await query
            if (error) throw error
            return new Response(JSON.stringify({ success: true, data: data || [], count: count ?? 0 }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncLocalById') {
            const localId = entityData?.localId
            if (!localId) throw new Error('localId is required')
            const { data: localWO, error } = await supabase
              .from('work_orders')
              .select('*')
              .eq('id', localId)
              .single()
            if (error || !localWO) throw new Error('Local work order not found')

            const buildiumData = await toBuildiumWorkOrder(localWO, supabase)
            let result: BuildiumWorkOrder
            if (localWO.buildium_work_order_id) {
              result = await buildiumClient.updateWorkOrder(Number(localWO.buildium_work_order_id), buildiumData)
            } else {
              result = await buildiumClient.createWorkOrder(buildiumData)
              await supabase
                .from('work_orders')
                .update({ buildium_work_order_id: result.Id, updated_at: new Date().toISOString() })
                .eq('id', localId)
            }
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'syncToBuildium') {
            const buildiumData = await toBuildiumWorkOrder(entityData, supabase)
            let result: BuildiumWorkOrder
            if (entityData.buildium_work_order_id) {
              result = await buildiumClient.updateWorkOrder(Number(entityData.buildium_work_order_id), buildiumData)
            } else {
              result = await buildiumClient.createWorkOrder(buildiumData)
              // update local row with returned Id if local id present
              if (entityData.id) {
                await supabase
                  .from('work_orders')
                  .update({ buildium_work_order_id: result.Id, updated_at: new Date().toISOString() })
                  .eq('id', entityData.id)
              }
            }
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
          } else if (operation === 'get') {
            const id = Number(entityData?.id || entityData?.Id)
            const wo = await buildiumClient.getWorkOrder(id)
            return new Response(JSON.stringify({ success: true, data: wo }), { headers: { 'Content-Type': 'application/json' } })
          } else {
            throw new Error(`Unsupported operation for workOrder: ${operation}`)
          }
        }

        case 'bankAccount': {
          // Map local shape to Buildium request
          const toBuildium = async (payload: any): Promise<any> => {
            const mapType = (t: string) => {
              const lc = (t || '').toLowerCase()
              if (lc === 'money_market' || lc === 'moneymarket') return 'MoneyMarket'
              if (lc === 'certificate_of_deposit' || lc === 'certificateofdeposit') return 'CertificateOfDeposit'
              if (lc === 'savings') return 'Savings'
              return 'Checking'
            }

            let glAccountId: number | undefined = payload.GLAccountId
            if (!glAccountId && payload.gl_account) {
              const { data: glRow } = await supabase
                .from('gl_accounts')
                .select('buildium_gl_account_id')
                .eq('id', payload.gl_account)
                .single()
              if (glRow?.buildium_gl_account_id) glAccountId = glRow.buildium_gl_account_id
            }

            return {
              Name: payload.name || payload.Name,
              Description: payload.description || payload.Description,
              BankAccountType: payload.BankAccountType || mapType(payload.bank_account_type || payload.bankAccountType),
              Country: payload.Country || payload.country || Deno.env.get('BUILDIUM_DEFAULT_BANK_COUNTRY') || 'United States',
              AccountNumber: payload.AccountNumber || payload.account_number || payload.accountNumber,
              RoutingNumber: payload.RoutingNumber || payload.routing_number || payload.routingNumber,
              IsActive: typeof payload.IsActive === 'boolean' ? payload.IsActive : (payload.is_active ?? payload.isActive ?? true),
              GLAccountId: glAccountId
            }
          }

          if (operation === 'create') {
            const buildiumData = await toBuildium(entityData)
            const sanitized = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.createBankAccount(sanitized)
          } else if (operation === 'update') {
            const buildiumData = await toBuildium(entityData)
            const sanitized = sanitizeForBuildium(buildiumData)
            result = await buildiumClient.updateBankAccount(entityData.buildium_bank_id || entityData.Id, sanitized)
          } else if (operation === 'syncFromBuildium') {
            const accounts = await buildiumClient.listBankAccounts()

            const synced = { syncedCount: 0, updatedCount: 0, errorCount: 0, errors: [] as string[] }

            const mapAcctTypeFromBuildium = (t: string) => {
              if (t === 'MoneyMarket') return 'money_market'
              if (t === 'CertificateOfDeposit') return 'certificate_of_deposit'
              return (t || '').toLowerCase()
            }

            // helper: ensure GL account exists locally and return uuid
            const ensureGL = async (gl: BuildiumGLAccount | undefined | null): Promise<string | null> => {
              const glId = gl?.Id
              if (!glId) return null
              const { data: existing, error: findErr } = await supabase
                .from('gl_accounts')
                .select('id')
                .eq('buildium_gl_account_id', glId)
                .single()
              if (existing) return existing.id
              // fetch from Buildium and insert
              const remote = await buildiumClient.getGLAccount(glId)
              const now = new Date().toISOString()
              const payload = {
                buildium_gl_account_id: remote.Id,
                account_number: remote.AccountNumber ?? null,
                name: remote.Name,
                description: remote.Description ?? null,
                type: remote.Type || 'Asset',
                sub_type: remote.SubType ?? null,
                is_default_gl_account: remote.IsDefaultGLAccount ?? null,
                default_account_name: remote.DefaultAccountName ?? null,
                is_contra_account: remote.IsContraAccount ?? null,
                is_bank_account: remote.IsBankAccount ?? null,
                cash_flow_classification: remote.CashFlowClassification ?? null,
                exclude_from_cash_balances: remote.ExcludeFromCashBalances ?? null,
                is_active: remote.IsActive ?? null,
                is_credit_card_account: remote.IsCreditCardAccount ?? null,
                buildium_parent_gl_account_id: remote.ParentGLAccountId ?? null,
                sub_accounts: (remote.SubAccounts || []).map(s => String(s.Id)),
                created_at: now,
                updated_at: now
              }
              const { data: inserted, error: insErr } = await supabase.from('gl_accounts').insert(payload).select('id').single()
              if (insErr) throw insErr
              return inserted.id
            }

            for (const acct of accounts) {
              try {
                const glAccountId = await ensureGL(acct.GLAccount)
                const now = new Date().toISOString()
                const row = {
                  buildium_bank_id: acct.Id,
                  name: acct.Name,
                  description: acct.Description ?? null,
                  bank_account_type: mapAcctTypeFromBuildium(acct.BankAccountType),
                  account_number: acct.AccountNumberUnmasked ?? acct.AccountNumber ?? null,
                  routing_number: acct.RoutingNumber ?? null,
                  is_active: acct.IsActive,
                  buildium_balance: typeof acct.Balance === 'number' ? acct.Balance : null,
                  gl_account: glAccountId,
                  check_printing_info: (acct as any).CheckPrintingInfo ?? null,
                  electronic_payments: (acct as any).ElectronicPayments ?? null,
                  updated_at: now,
                  last_source: 'buildium',
                  last_source_ts: now
                }

                // upsert by buildium_bank_id
                const { data: existing, error: findErr } = await supabase
                  .from('bank_accounts')
                  .select('id, last_source, last_source_ts')
                  .eq('buildium_bank_id', acct.Id)
                  .single()
                if (existing) {
                  // Basic conflict policy: if local was edited very recently, mark conflict and skip overwrite
                  let shouldOverwrite = true
                  try {
                    const src = (existing as any).last_source
                    const ts = (existing as any).last_source_ts ? new Date((existing as any).last_source_ts) : null
                    const nowDate = new Date(now)
                    if (src === 'local' && ts) {
                      const diffMs = nowDate.getTime() - ts.getTime()
                      if (diffMs < 10 * 60 * 1000) { // 10 minutes grace window
                        shouldOverwrite = false
                        await supabase.rpc('update_buildium_sync_status', {
                          p_entity_type: 'bankAccount',
                          p_entity_id: String(acct.Id),
                          p_buildium_id: acct.Id,
                          p_status: 'conflict',
                          p_error_message: 'Skipped overwrite due to recent local changes'
                        })
                      }
                    }
                  } catch (_) { /* non-fatal */ }

                  if (shouldOverwrite) {
                    const { error: updErr } = await supabase.from('bank_accounts').update(row).eq('id', existing.id)
                    if (updErr) throw updErr
                    synced.updatedCount++
                  }
                } else {
                  const insertRow = { ...row, created_at: now }
                  const { error: insErr } = await supabase.from('bank_accounts').insert(insertRow)
                  if (insErr) throw insErr
                  synced.syncedCount++
                }

                // mark sync status
                await supabase.rpc('update_buildium_sync_status', {
                  p_entity_type: 'bankAccount',
                  p_entity_id: String(acct.Id),
                  p_buildium_id: acct.Id,
                  p_status: 'synced'
                })
              } catch (e) {
                synced.errorCount++
                const msg = (e as Error)?.message || 'Unknown error'
                synced.errors.push(`BankAccount ${acct?.Id}: ${msg}`)
              }
            }

            result = synced
          } else {
            throw new Error(`Unsupported operation for bankAccount: ${operation}`)
          }
          break
        }

        case 'glAccount': {
          if (operation === 'create') {
            // pass-through payload; caller should send GLAccount shape
            result = await buildiumClient.makeRequest<any>('POST', '/glaccounts', sanitizeForBuildium(entityData))
          } else if (operation === 'update') {
            result = await buildiumClient.makeRequest<any>('PUT', `/glaccounts/${entityData.Id || entityData.buildium_gl_account_id}`, sanitizeForBuildium(entityData))
          } else if (operation === 'syncFromBuildium') {
            const synced = { inserted: 0, updated: 0, failed: 0 }
            const list = await buildiumClient.listGLAccounts({ limit: body?.limit || 100, offset: body?.offset || 0, type: body?.type, subType: body?.subType, isActive: body?.isActive })
            for (const acc of list || []) {
              try {
                const now = new Date().toISOString()
                const row = {
                  buildium_gl_account_id: acc.Id,
                  account_number: acc.AccountNumber ?? null,
                  name: acc.Name,
                  description: acc.Description ?? null,
                  type: acc.Type,
                  sub_type: acc.SubType ?? null,
                  is_default_gl_account: !!acc.IsDefaultGLAccount,
                  default_account_name: acc.DefaultAccountName ?? null,
                  is_contra_account: !!acc.IsContraAccount,
                  is_bank_account: !!acc.IsBankAccount,
                  cash_flow_classification: acc.CashFlowClassification ?? null,
                  exclude_from_cash_balances: !!acc.ExcludeFromCashBalances,
                  is_active: acc.IsActive ?? true,
                  buildium_parent_gl_account_id: acc.ParentGLAccountId ?? null,
                  is_credit_card_account: !!acc.IsCreditCardAccount,
                  updated_at: now
                }

                const { data: existing, error: findErr } = await supabase
                  .from('gl_accounts')
                  .select('id')
                  .eq('buildium_gl_account_id', acc.Id)
                  .single()
                if (findErr && findErr.code !== 'PGRST116') throw findErr

                if (existing) {
                  const { error } = await supabase.from('gl_accounts').update(row).eq('id', existing.id)
                  if (error) throw error
                  synced.updated++
                } else {
                  const { error } = await supabase.from('gl_accounts').insert({ ...row, created_at: row.updated_at })
                  if (error) throw error
                  synced.inserted++
                }
              } catch (_) { synced.failed++ }
            }
            result = synced
          } else {
            throw new Error(`Unsupported operation for glAccount: ${operation}`)
          }
          break
        }

        case 'glEntry': {
          if (operation === 'syncFromBuildium') {
            let { dateFrom, dateTo, glAccountId, limit = 100, offset = 0, overlapDays = 7 } = body || {}
            if (!dateFrom || !dateTo) {
              const cursor = await getCursor(supabase, 'gl_entries')
              const lastAt = cursor?.last_imported_at || '1970-01-01T00:00:00Z'
              const window = Number(cursor?.window_days ?? overlapDays)
              const start = new Date(lastAt)
              start.setUTCDate(start.getUTCDate() - (isNaN(window) ? 7 : window))
              dateFrom = dateFrom || start.toISOString().slice(0, 10)
              dateTo = dateTo || new Date().toISOString().slice(0, 10)
            }

            const qp: Record<string,string> = {}
            if (dateFrom) qp['dateFrom'] = String(dateFrom)
            if (dateTo) qp['dateTo'] = String(dateTo)
            if (glAccountId) qp['glAccountId'] = String(glAccountId)
            qp['limit'] = String(limit)
            qp['offset'] = String(offset)

            const entries = await buildiumClient.listGLEntries(qp)
            let upserted = 0, failed = 0
            for (const e of entries || []) {
              try {
                await upsertGLEntry(supabase, buildiumClient, e)
                upserted++
              } catch (_) { failed++ }
            }

            const to = dateTo ? new Date(String(dateTo)).toISOString() : new Date().toISOString()
            await setCursor(supabase, 'gl_entries', to, overlapDays)
            result = { upserted, failed, dateFrom, dateTo }
          } else {
            throw new Error(`Unsupported operation for glEntry: ${operation}`)
          }
          break
        }

        default:
          throw new Error(`Unsupported entity type: ${entityType}`)
      }

      // Update sync status in database
      await supabase.rpc('update_buildium_sync_status', {
        p_entity_type: entityType,
        p_entity_id: entityData.id,
        p_buildium_id: result.Id,
        p_status: 'synced'
      })

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          message: `${entityType} synced successfully`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    if (method === 'GET') {
      const { searchParams } = url
      const entityType = searchParams.get('entityType')
      const entityId = searchParams.get('entityId')

      if (entityType && entityId) {
        let result: any

        if (entityType === 'property') {
          result = await buildiumClient.getProperty(parseInt(entityId))
        } else if (entityType === 'owner') {
          result = await buildiumClient.getOwner(parseInt(entityId))
        } else if (entityType === 'bankAccount') {
          result = await buildiumClient.getBankAccount(parseInt(entityId))
        } else if (entityType === 'units') {
          result = await buildiumClient.getUnits(parseInt(entityId))
        } else if (entityType === 'glAccount') {
          result = await buildiumClient.getGLAccount(parseInt(entityId))
        } else if (entityType === 'glEntry') {
          result = await buildiumClient.getGLEntry(parseInt(entityId))
        } else if (entityType === 'glTransaction') {
          result = await buildiumClient.makeRequest<any>('GET', `/gltransactions/${parseInt(entityId)}`)
        } else if (entityType === 'glAccountBalance') {
          const asOfDate = searchParams.get('asOfDate') || undefined
          result = await buildiumClient.getGLAccountBalance(parseInt(entityId), asOfDate)
        } else {
          throw new Error(`Unsupported entity type: ${entityType}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: result
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      // Collection GETs via query params
      if (entityType && !entityId) {
        let result: any
        if (entityType === 'glAccounts') {
          const params: Record<string, string | number | boolean> = {}
          for (const key of ['type','subType','isActive','limit','offset']) {
            const v = searchParams.get(key)
            if (v !== null) params[key] = key === 'isActive' ? (v === 'true') : (isNaN(Number(v)) ? v : Number(v))
          }
          result = await buildiumClient.listGLAccounts(params)
        } else if (entityType === 'glEntries') {
          const params: Record<string, string | number | boolean> = {}
          for (const key of ['glAccountId','dateFrom','dateTo','limit','offset']) {
            const v = searchParams.get(key)
            if (v !== null) params[key] = isNaN(Number(v)) ? v : Number(v)
          }
          result = await buildiumClient.listGLEntries(params)
        } else if (entityType === 'glTransactions') {
          const params: Record<string, string | number | boolean> = {}
          for (const key of ['glAccountId','dateFrom','dateTo','limit','offset']) {
            const v = searchParams.get(key)
            if (v !== null) params[key] = isNaN(Number(v)) ? v : Number(v)
          }
          result = await buildiumClient.listGLTransactions(params)
        } else {
          throw new Error(`Unsupported list type: ${entityType}`)
        }
        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not supported' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('Error in buildium-sync function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Content-Type': 'application/json' 
        },
        status: 500,
      }
    )
  }
})
        case 'raw': {
          const method = String(body?.method || entityData?.method || 'GET')
          const path = String(body?.path || entityData?.path || '')
          if (!path) throw new Error('path is required for raw proxy')
          const params = (body?.params || entityData?.params || {}) as Record<string,string|number|boolean>
          const payload = (body?.payload || entityData?.payload)
          const result = await buildiumClient.raw(method, path, params, payload)
          return new Response(JSON.stringify({ success: true, data: result }), { headers: { 'Content-Type': 'application/json' } })
        }
