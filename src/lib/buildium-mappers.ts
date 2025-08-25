// Buildium Data Mappers
// This file contains functions to map between local database format and Buildium API format

import type {
  BuildiumProperty,
  BuildiumPropertyCreate,
  BuildiumUnit,
  BuildiumUnitCreate,
  BuildiumOwner,
  BuildiumOwnerCreate,
  BuildiumVendor,
  BuildiumVendorCreate,
  BuildiumTask,
  BuildiumTaskCreate,
  BuildiumBill,
  BuildiumBillCreate,
  BuildiumBankAccount,
  BuildiumBankAccountCreate,
  BuildiumLease,
  BuildiumLeaseCreate,
  BuildiumSyncStatus
} from '../types/buildium'

// ============================================================================
// PROPERTY MAPPERS
// ============================================================================

export function mapPropertyToBuildium(localProperty: any): BuildiumPropertyCreate {
  return {
    Name: localProperty.name,
    StructureDescription: localProperty.structure_description || undefined,
    NumberUnits: localProperty.number_units || undefined,
    IsActive: localProperty.is_active !== false,
    OperatingBankAccountId: localProperty.operating_bank_account_id || undefined,
    Reserve: localProperty.reserve || undefined,
    Address: {
      AddressLine1: localProperty.address_line1,
      AddressLine2: localProperty.address_line2 || undefined,
      AddressLine3: localProperty.address_line3 || undefined,
      City: localProperty.city || '',
      State: localProperty.state || '',
      PostalCode: localProperty.postal_code,
      Country: localProperty.country
    },
    YearBuilt: localProperty.year_built || undefined,
    RentalType: localProperty.rental_type || 'Rental',
    RentalSubType: localProperty.rental_sub_type || 'SingleFamily',
    RentalManager: localProperty.rental_manager || undefined
  }
}

export function mapPropertyFromBuildium(buildiumProperty: BuildiumProperty): any {
  return {
    name: buildiumProperty.Name,
    rental_type: buildiumProperty.RentalType,
    rental_sub_type: buildiumProperty.RentalSubType,
    address_line1: buildiumProperty.Address.AddressLine1,
    address_line2: buildiumProperty.Address.AddressLine2,
    city: buildiumProperty.Address.City,
    state: buildiumProperty.Address.State,
    postal_code: buildiumProperty.Address.PostalCode,
    country: buildiumProperty.Address.Country,
    year_built: buildiumProperty.YearBuilt,
    is_active: buildiumProperty.IsActive,
    // Note: Description field doesn't exist in BuildiumProperty
    buildium_property_id: buildiumProperty.Id,
    buildium_created_at: buildiumProperty.CreatedDate,
    buildium_updated_at: buildiumProperty.ModifiedDate
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

function mapPropertyTypeFromBuildium(buildiumType: 'Rental' | 'Association' | 'Commercial'): string {
  switch (buildiumType) {
    case 'Commercial':
      return 'Office' // Default to Office for commercial properties
    case 'Association':
      return 'Rental' // Map association to rental
    default:
      return 'Rental'
  }
}

// ============================================================================
// UNIT MAPPERS
// ============================================================================

export function mapUnitToBuildium(localUnit: any): BuildiumUnitCreate {
  return {
    PropertyId: localUnit.buildium_property_id || localUnit.property_id,
    UnitType: mapUnitTypeToBuildium(localUnit.unit_type || 'Apartment'),
    Number: localUnit.unit_number || localUnit.number || '',
    SquareFootage: localUnit.square_footage || undefined,
    Bedrooms: localUnit.bedrooms || undefined,
    Bathrooms: localUnit.bathrooms || undefined,
    IsActive: localUnit.is_active !== false
    // Note: Description, RentAmount, SecurityDepositAmount fields don't exist in BuildiumUnitCreate
  }
}

export function mapUnitFromBuildium(buildiumUnit: BuildiumUnit): any {
  return {
    unit_number: buildiumUnit.Number,
    unit_type: mapUnitTypeFromBuildium(buildiumUnit.UnitType),
    square_footage: buildiumUnit.SquareFootage,
    bedrooms: buildiumUnit.Bedrooms,
    bathrooms: buildiumUnit.Bathrooms,
    is_active: buildiumUnit.IsActive,
    // Note: Description, RentAmount, SecurityDepositAmount fields don't exist in BuildiumUnit
    buildium_unit_id: buildiumUnit.Id,
    buildium_property_id: buildiumUnit.PropertyId,
    buildium_created_at: buildiumUnit.CreatedDate,
    buildium_updated_at: buildiumUnit.ModifiedDate
  }
}

function mapUnitTypeToBuildium(localType: string): 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other' {
  switch (localType?.toLowerCase()) {
    case 'apartment':
      return 'Apartment'
    case 'condo':
    case 'condominium':
      return 'Condo'
    case 'house':
      return 'House'
    case 'townhouse':
      return 'Townhouse'
    case 'office':
      return 'Office'
    case 'retail':
      return 'Retail'
    case 'warehouse':
      return 'Warehouse'
    default:
      return 'Other'
  }
}

function mapUnitTypeFromBuildium(buildiumType: 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other'): string {
  return buildiumType
}

// ============================================================================
// OWNER MAPPERS
// ============================================================================

export function mapOwnerToBuildium(localOwner: any): BuildiumOwnerCreate {
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
    // Note: Notes field doesn't exist in BuildiumOwnerCreate
  }
}

export function mapOwnerFromBuildium(buildiumOwner: BuildiumOwner): any {
  return {
    name: `${buildiumOwner.FirstName} ${buildiumOwner.LastName}`.trim(),
    email: buildiumOwner.Email,
    phone_number: buildiumOwner.PhoneNumber,
    address_line1: buildiumOwner.Address.AddressLine1,
    address_line2: buildiumOwner.Address.AddressLine2,
    city: buildiumOwner.Address.City,
    state: buildiumOwner.Address.State,
    postal_code: buildiumOwner.Address.PostalCode,
    country: buildiumOwner.Address.Country,
    tax_id: buildiumOwner.TaxId,
    is_active: buildiumOwner.IsActive,
    // Note: Notes field doesn't exist in BuildiumOwner
    buildium_owner_id: buildiumOwner.Id,
    buildium_created_at: buildiumOwner.CreatedDate,
    buildium_updated_at: buildiumOwner.ModifiedDate
  }
}

// ============================================================================
// VENDOR MAPPERS
// ============================================================================

export function mapVendorToBuildium(localVendor: any): BuildiumVendorCreate {
  return {
    Name: localVendor.name,
    CategoryId: localVendor.category_id || undefined,
    ContactName: localVendor.contact_name || undefined,
    Email: localVendor.email || undefined,
    PhoneNumber: localVendor.phone_number || undefined,
    Address: {
      AddressLine1: localVendor.address_line1 || '',
      AddressLine2: localVendor.address_line2 || undefined,
      City: localVendor.city || '',
      State: localVendor.state || '',
      PostalCode: localVendor.postal_code || '',
      Country: localVendor.country || 'US'
    },
    TaxId: localVendor.tax_id || undefined,
    Notes: localVendor.notes || undefined,
    IsActive: localVendor.is_active !== false
  }
}

export function mapVendorFromBuildium(buildiumVendor: BuildiumVendor): any {
  return {
    name: buildiumVendor.Name,
    category_id: buildiumVendor.CategoryId,
    contact_name: buildiumVendor.ContactName,
    email: buildiumVendor.Email,
    phone_number: buildiumVendor.PhoneNumber,
    address_line1: buildiumVendor.Address.AddressLine1,
    address_line2: buildiumVendor.Address.AddressLine2,
    city: buildiumVendor.Address.City,
    state: buildiumVendor.Address.State,
    postal_code: buildiumVendor.Address.PostalCode,
    country: buildiumVendor.Address.Country,
    tax_id: buildiumVendor.TaxId,
    notes: buildiumVendor.Notes,
    is_active: buildiumVendor.IsActive,
    buildium_vendor_id: buildiumVendor.Id,
    buildium_created_at: buildiumVendor.CreatedDate,
    buildium_updated_at: buildiumVendor.ModifiedDate
  }
}

// ============================================================================
// TASK MAPPERS
// ============================================================================

export function mapTaskToBuildium(localTask: any): BuildiumTaskCreate {
  return {
    PropertyId: localTask.buildium_property_id || localTask.property_id,
    UnitId: localTask.buildium_unit_id || localTask.unit_id,
    Subject: localTask.subject,
    Description: localTask.description || undefined,
    Priority: mapTaskPriorityToBuildium(localTask.priority || 'Medium'),
    Status: mapTaskStatusToBuildium(localTask.status || 'Open'),
    AssignedTo: localTask.assigned_to || undefined,
    EstimatedCost: localTask.estimated_cost || undefined,
    Category: localTask.category || undefined,
    Notes: localTask.notes || undefined
  }
}

export function mapTaskFromBuildium(buildiumTask: BuildiumTask): any {
  return {
    subject: buildiumTask.Subject,
    description: buildiumTask.Description,
    priority: mapTaskPriorityFromBuildium(buildiumTask.Priority),
    status: mapTaskStatusFromBuildium(buildiumTask.Status),
    assigned_to: buildiumTask.AssignedTo,
    estimated_cost: buildiumTask.EstimatedCost,
    actual_cost: buildiumTask.ActualCost,
    scheduled_date: buildiumTask.ScheduledDate,
    completed_date: buildiumTask.CompletedDate,
    category: buildiumTask.Category,
    notes: buildiumTask.Notes,
    buildium_task_id: buildiumTask.Id,
    buildium_property_id: buildiumTask.PropertyId,
    buildium_unit_id: buildiumTask.UnitId,
    buildium_created_at: buildiumTask.CreatedDate,
    buildium_updated_at: buildiumTask.ModifiedDate
  }
}

function mapTaskPriorityToBuildium(localPriority: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  switch (localPriority?.toLowerCase()) {
    case 'low':
      return 'Low'
    case 'high':
      return 'High'
    case 'critical':
      return 'Critical'
    default:
      return 'Medium'
  }
}

function mapTaskPriorityFromBuildium(buildiumPriority: 'Low' | 'Medium' | 'High' | 'Critical'): string {
  return buildiumPriority.toLowerCase()
}

function mapTaskStatusToBuildium(localStatus: string): 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold' {
  switch (localStatus?.toLowerCase()) {
    case 'in_progress':
    case 'inprogress':
      return 'InProgress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'on_hold':
    case 'onhold':
      return 'OnHold'
    default:
      return 'Open'
  }
}

function mapTaskStatusFromBuildium(buildiumStatus: 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold'): string {
  switch (buildiumStatus) {
    case 'InProgress':
      return 'in_progress'
    case 'OnHold':
      return 'on_hold'
    default:
      return buildiumStatus.toLowerCase()
  }
}

// ============================================================================
// BILL MAPPERS
// ============================================================================

export function mapBillToBuildium(localBill: any): BuildiumBillCreate {
  return {
    VendorId: localBill.buildium_vendor_id || localBill.vendor_id,
    PropertyId: localBill.buildium_property_id || localBill.property_id,
    UnitId: localBill.buildium_unit_id || localBill.unit_id,
    Date: localBill.date,
    DueDate: localBill.due_date || undefined,
    Amount: localBill.amount,
    Description: localBill.description,
    ReferenceNumber: localBill.reference_number || undefined,
    CategoryId: localBill.category_id || undefined,
    IsRecurring: localBill.is_recurring || false,
    RecurringSchedule: localBill.recurring_schedule || undefined,
    Status: mapBillStatusToBuildium(localBill.status || 'Pending')
  }
}

export function mapBillFromBuildium(buildiumBill: BuildiumBill): any {
  return {
    vendor_id: buildiumBill.VendorId,
    property_id: buildiumBill.PropertyId,
    unit_id: buildiumBill.UnitId,
    date: buildiumBill.Date,
    due_date: buildiumBill.DueDate,
    amount: buildiumBill.Amount,
    description: buildiumBill.Description,
    reference_number: buildiumBill.ReferenceNumber,
    category_id: buildiumBill.CategoryId,
    is_recurring: buildiumBill.IsRecurring,
    recurring_schedule: buildiumBill.RecurringSchedule,
    status: mapBillStatusFromBuildium(buildiumBill.Status),
    buildium_bill_id: buildiumBill.Id,
    buildium_created_at: buildiumBill.CreatedDate,
    buildium_updated_at: buildiumBill.ModifiedDate
  }
}

function mapBillStatusToBuildium(localStatus: string): 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid' {
  switch (localStatus?.toLowerCase()) {
    case 'paid':
      return 'Paid'
    case 'overdue':
      return 'Overdue'
    case 'cancelled':
      return 'Cancelled'
    case 'partially_paid':
    case 'partiallypaid':
      return 'PartiallyPaid'
    default:
      return 'Pending'
  }
}

function mapBillStatusFromBuildium(buildiumStatus: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid'): string {
  switch (buildiumStatus) {
    case 'PartiallyPaid':
      return 'partially_paid'
    default:
      return buildiumStatus.toLowerCase()
  }
}

// ============================================================================
// BANK ACCOUNT MAPPERS
// ============================================================================

export function mapBankAccountToBuildium(localBankAccount: any): BuildiumBankAccountCreate {
  return {
    Name: localBankAccount.name,
    BankAccountType: mapBankAccountTypeToBuildium(localBankAccount.bank_account_type || 'Checking'),
    AccountNumber: localBankAccount.account_number,
    RoutingNumber: localBankAccount.routing_number,
    Description: localBankAccount.description || undefined,
    IsActive: localBankAccount.is_active !== false
  }
}

export function mapBankAccountFromBuildium(buildiumBankAccount: BuildiumBankAccount): any {
  return {
    name: buildiumBankAccount.Name,
    bank_account_type: mapBankAccountTypeFromBuildium(buildiumBankAccount.BankAccountType),
    account_number: buildiumBankAccount.AccountNumber,
    routing_number: buildiumBankAccount.RoutingNumber,
    description: buildiumBankAccount.Description,
    is_active: buildiumBankAccount.IsActive,
    buildium_bank_id: buildiumBankAccount.Id,
    buildium_created_at: buildiumBankAccount.CreatedDate,
    buildium_updated_at: buildiumBankAccount.ModifiedDate
  }
}

function mapBankAccountTypeToBuildium(localType: string): 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit' {
  switch (localType?.toLowerCase()) {
    case 'savings':
      return 'Savings'
    case 'money_market':
    case 'moneymarket':
      return 'MoneyMarket'
    case 'certificate_of_deposit':
    case 'certificateofdeposit':
      return 'CertificateOfDeposit'
    default:
      return 'Checking'
  }
}

function mapBankAccountTypeFromBuildium(buildiumType: 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit'): string {
  switch (buildiumType) {
    case 'MoneyMarket':
      return 'money_market'
    case 'CertificateOfDeposit':
      return 'certificate_of_deposit'
    default:
      return buildiumType.toLowerCase()
  }
}

// ============================================================================
// LEASE MAPPERS
// ============================================================================

export function mapLeaseToBuildium(localLease: any): BuildiumLeaseCreate {
  return {
    PropertyId: localLease.buildium_property_id || localLease.property_id,
    UnitId: localLease.buildium_unit_id || localLease.unit_id,
    Status: mapLeaseStatusToBuildium(localLease.status || 'Active'),
    StartDate: localLease.start_date,
    EndDate: localLease.end_date || undefined,
    RentAmount: localLease.rent_amount,
    SecurityDepositAmount: localLease.security_deposit_amount || undefined
  }
}

export function mapLeaseFromBuildium(buildiumLease: BuildiumLease): any {
  return {
    property_id: buildiumLease.PropertyId,
    unit_id: buildiumLease.UnitId,
    status: mapLeaseStatusFromBuildium(buildiumLease.Status),
    start_date: buildiumLease.StartDate,
    end_date: buildiumLease.EndDate,
    rent_amount: buildiumLease.RentAmount,
    security_deposit_amount: buildiumLease.SecurityDepositAmount,
    buildium_lease_id: buildiumLease.Id,
    buildium_created_at: buildiumLease.CreatedDate,
    buildium_updated_at: buildiumLease.ModifiedDate
  }
}

function mapLeaseStatusToBuildium(localStatus: string): 'Future' | 'Active' | 'Past' | 'Cancelled' {
  switch (localStatus?.toLowerCase()) {
    case 'future':
      return 'Future'
    case 'past':
      return 'Past'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Active'
  }
}

function mapLeaseStatusFromBuildium(buildiumStatus: 'Future' | 'Active' | 'Past' | 'Cancelled'): string {
  return buildiumStatus.toLowerCase()
}

// ============================================================================
// SYNC STATUS MAPPERS
// ============================================================================

export function mapSyncStatusToBuildium(localSyncStatus: any): BuildiumSyncStatus {
  return {
    entityType: localSyncStatus.entity_type,
    entityId: localSyncStatus.entity_id,
    buildiumId: localSyncStatus.buildium_id || undefined,
    lastSyncedAt: localSyncStatus.last_synced_at || undefined,
    syncStatus: localSyncStatus.sync_status,
    errorMessage: localSyncStatus.error_message || undefined,
    createdAt: localSyncStatus.created_at,
    updatedAt: localSyncStatus.updated_at
  }
}

export function mapSyncStatusFromBuildium(buildiumSyncStatus: BuildiumSyncStatus): any {
  return {
    entity_type: buildiumSyncStatus.entityType,
    entity_id: buildiumSyncStatus.entityId,
    buildium_id: buildiumSyncStatus.buildiumId,
    last_synced_at: buildiumSyncStatus.lastSyncedAt,
    sync_status: buildiumSyncStatus.syncStatus,
    error_message: buildiumSyncStatus.errorMessage,
    created_at: buildiumSyncStatus.createdAt,
    updated_at: buildiumSyncStatus.updatedAt
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function sanitizeForBuildium(data: any): any {
  // Remove undefined values and null values that Buildium doesn't accept
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key]
    }
  })
  
  return sanitized
}

export function validateBuildiumResponse(response: any): boolean {
  // Basic validation for Buildium API responses
  return response && typeof response === 'object' && !response.error
}

export function extractBuildiumId(response: any): number | null {
  // Extract Buildium ID from various response formats
  if (response?.Id) return response.Id
  if (response?.id) return response.id
  if (response?.data?.Id) return response.data.Id
  return null
}
