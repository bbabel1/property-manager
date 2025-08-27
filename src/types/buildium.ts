// Buildium API Types
// This file contains all TypeScript types for Buildium API integration

// ============================================================================
// BASE TYPES
// ============================================================================

export type BuildiumPropertyType = 'Rental' | 'Association' | 'Commercial';
export type BuildiumUnitType = 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other';
export type BuildiumTaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type BuildiumTaskStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold';
export type BuildiumBillStatus = 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid';
export type BuildiumPaymentMethod = 'Check' | 'Cash' | 'CreditCard' | 'BankTransfer' | 'OnlinePayment';
export type BuildiumVendorCategory = 'Contractor' | 'Maintenance' | 'Utilities' | 'Insurance' | 'Legal' | 'Accounting' | 'Marketing' | 'Other';
export type BuildiumBankAccountType = 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit';
export type BuildiumLeaseStatus = 'Future' | 'Active' | 'Past' | 'Cancelled';
export type BuildiumLeaseContactRole = 'Tenant' | 'Cosigner' | 'Guarantor';
export type BuildiumWebhookEventType = 
  | 'PropertyCreated' | 'PropertyUpdated' | 'PropertyDeleted'
  | 'UnitCreated' | 'UnitUpdated' | 'UnitDeleted'
  | 'OwnerCreated' | 'OwnerUpdated' | 'OwnerDeleted'
  | 'LeaseCreated' | 'LeaseUpdated' | 'LeaseDeleted'
  | 'BillCreated' | 'BillUpdated' | 'BillPaid'
  | 'TaskCreated' | 'TaskUpdated' | 'TaskCompleted';
export type BuildiumSyncStatusType = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

// ============================================================================
// PROPERTY TYPES
// ============================================================================

export interface BuildiumProperty {
  Id: number;
  Name: string;
  StructureDescription?: string;
  NumberUnits?: number;
  IsActive: boolean;
  OperatingBankAccountId?: number;
  Reserve?: number;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    AddressLine3?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  YearBuilt?: number;
  RentalType: 'Rental' | 'Association' | 'Commercial';
  RentalSubType: string;
  RentalManager?: number;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumPropertyCreate {
  Name: string;
  StructureDescription?: string;
  NumberUnits?: number;
  IsActive?: boolean;
  OperatingBankAccountId?: number;
  Reserve?: number;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    AddressLine3?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  YearBuilt?: number;
  RentalType: 'Rental' | 'Association' | 'Commercial';
  RentalSubType: string;
  RentalManager?: number;
}

export interface BuildiumPropertyUpdate extends Partial<BuildiumPropertyCreate> {}

// ============================================================================
// UNIT TYPES
// ============================================================================

export interface BuildiumUnit {
  Id: number;
  PropertyId: number;
  UnitType: BuildiumUnitType;
  Number: string;
  SquareFootage?: number;
  UnitSize?: number;
  Bedrooms?: number;
  Bathrooms?: number;
  MarketRent?: number;
  Description?: string;
  IsActive: boolean;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumUnitCreate {
  PropertyId: number;
  UnitType: BuildiumUnitType;
  Number: string;
  SquareFootage?: number;
  Bedrooms?: number;
  Bathrooms?: number;
  IsActive?: boolean;
}

export interface BuildiumUnitUpdate extends Partial<BuildiumUnitCreate> {}

// ============================================================================
// OWNER TYPES
// ============================================================================

export interface BuildiumOwner {
  Id: number;
  FirstName: string;
  LastName: string;
  Email?: string;
  PhoneNumber?: string;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  ManagementAgreementStartDate?: string; // ISO 8601
  ManagementAgreementEndDate?: string; // ISO 8601
  TaxInformation?: {
    TaxPayerIdType?: string;
    TaxPayerId?: string;
    TaxPayerName1?: string;
    TaxPayerName2?: string;
    IncludeIn1099?: boolean;
    Address?: {
      AddressLine1?: string;
      AddressLine2?: string;
      AddressLine3?: string;
      City?: string;
      State?: string;
      PostalCode?: string;
      Country?: string;
    };
  };
  TaxId?: string; // Legacy field, prefer TaxInformation.TaxPayerId
  IsActive: boolean;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumOwnerCreate {
  FirstName: string;
  LastName: string;
  Email?: string;
  PhoneNumber?: string;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  TaxId?: string;
  IsActive?: boolean;
}

export interface BuildiumOwnerUpdate extends Partial<BuildiumOwnerCreate> {}

// ============================================================================
// LEASE TYPES
// ============================================================================

export interface BuildiumLease {
  Id: number;
  PropertyId: number;
  UnitId?: number;
  Status: BuildiumLeaseStatus;
  StartDate: string; // ISO 8601
  EndDate?: string; // ISO 8601
  RentAmount: number;
  SecurityDepositAmount?: number;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumLeaseCreate {
  PropertyId: number;
  UnitId?: number;
  Status: BuildiumLeaseStatus;
  StartDate: string; // ISO 8601
  EndDate?: string; // ISO 8601
  RentAmount: number;
  SecurityDepositAmount?: number;
}

export interface BuildiumLeaseUpdate extends Partial<BuildiumLeaseCreate> {}

// ============================================================================
// VENDOR TYPES
// ============================================================================

export interface BuildiumVendor {
  Id: number;
  Name: string;
  CategoryId?: number;
  ContactName?: string;
  Email?: string;
  PhoneNumber?: string;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  TaxId?: string;
  Notes?: string;
  IsActive: boolean;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumVendorCreate {
  Name: string;
  CategoryId?: number;
  ContactName?: string;
  Email?: string;
  PhoneNumber?: string;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  TaxId?: string;
  Notes?: string;
  IsActive?: boolean;
}

export interface BuildiumVendorUpdate extends Partial<BuildiumVendorCreate> {}

// ============================================================================
// BILL TYPES
// ============================================================================

export interface BuildiumBill {
  Id: number;
  VendorId: number;
  PropertyId?: number;
  UnitId?: number;
  Date: string; // ISO 8601
  DueDate?: string; // ISO 8601
  Amount: number;
  Description: string;
  ReferenceNumber?: string;
  CategoryId?: number;
  IsRecurring: boolean;
  RecurringSchedule?: {
    Frequency: 'Monthly' | 'Quarterly' | 'Yearly';
    StartDate: string; // ISO 8601
    EndDate?: string; // ISO 8601
  };
  Status: BuildiumBillStatus;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumBillCreate {
  VendorId: number;
  PropertyId?: number;
  UnitId?: number;
  Date: string; // ISO 8601
  DueDate?: string; // ISO 8601
  Amount: number;
  Description: string;
  ReferenceNumber?: string;
  CategoryId?: number;
  IsRecurring?: boolean;
  RecurringSchedule?: {
    Frequency: 'Monthly' | 'Quarterly' | 'Yearly';
    StartDate: string; // ISO 8601
    EndDate?: string; // ISO 8601
  };
  Status?: BuildiumBillStatus;
}

export interface BuildiumBillUpdate extends Partial<BuildiumBillCreate> {}

// ============================================================================
// TASK TYPES
// ============================================================================

export interface BuildiumTask {
  Id: number;
  PropertyId?: number;
  UnitId?: number;
  Subject: string;
  Description?: string;
  Priority: BuildiumTaskPriority;
  Status: BuildiumTaskStatus;
  AssignedTo?: string;
  EstimatedCost?: number;
  ActualCost?: number;
  ScheduledDate?: string; // ISO 8601
  CompletedDate?: string; // ISO 8601
  Category?: string;
  Notes?: string;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumTaskCreate {
  PropertyId?: number;
  UnitId?: number;
  Subject: string;
  Description?: string;
  Priority?: BuildiumTaskPriority;
  Status?: BuildiumTaskStatus;
  AssignedTo?: string;
  EstimatedCost?: number;
  Category?: string;
  Notes?: string;
}

export interface BuildiumTaskUpdate extends Partial<BuildiumTaskCreate> {}

// ============================================================================
// JOURNAL ENTRY TYPES
// ============================================================================

export type BuildiumPostingType = 'Credit' | 'Debit';

export interface BuildiumJournalEntryLine {
  GLAccountId: number;
  Amount: number;
  PostingType: BuildiumPostingType;
  Memo?: string;
}

export interface BuildiumJournalEntry {
  Id: number;
  Date: string; // ISO 8601
  Memo?: string;
  Lines: BuildiumJournalEntryLine[];
  TransactionType: string;
  TotalAmount: number;
  CheckNumber?: string;
}

// ============================================================================
// BANK ACCOUNT TYPES
// ============================================================================

export interface BuildiumBankAccount {
  Id: number;
  Name: string;
  BankAccountType: BuildiumBankAccountType;
  AccountNumber: string;
  RoutingNumber: string;
  Description?: string;
  IsActive: boolean;
  CreatedDate: string; // ISO 8601
  ModifiedDate: string; // ISO 8601
}

export interface BuildiumBankAccountCreate {
  Name: string;
  BankAccountType: BuildiumBankAccountType;
  AccountNumber: string;
  RoutingNumber: string;
  Description?: string;
  IsActive?: boolean;
}

export interface BuildiumBankAccountUpdate extends Partial<BuildiumBankAccountCreate> {}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface BuildiumWebhookEvent {
  Id: string;
  EventType: BuildiumWebhookEventType;
  EntityId: number;
  EntityType: string;
  EventDate: string; // ISO 8601
  Data: any; // The actual entity data
}

export interface BuildiumWebhookPayload {
  Events: BuildiumWebhookEvent[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface BuildiumApiResponse<T> {
  Data: T[];
  TotalCount: number;
  PageSize: number;
  PageNumber: number;
  TotalPages: number;
}

export interface BuildiumApiError {
  Message: string;
  ErrorCode?: string;
  Details?: any;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface BuildiumSyncStatus {
  entityType: string;
  entityId: string;
  buildiumId?: number;
  lastSyncedAt?: string; // ISO 8601
  syncStatus: BuildiumSyncStatusType;
  errorMessage?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ============================================================================
// MAPPING TYPES
// ============================================================================

export interface LocalToBuildiumMapping<TLocal, TBuildium> {
  mapToBuildium(local: TLocal): TBuildium;
  mapFromBuildium(buildium: TBuildium): TLocal;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type BuildiumEntityType = 'property' | 'unit' | 'owner' | 'lease' | 'vendor' | 'bill' | 'task' | 'bank_account';

export interface BuildiumApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}
