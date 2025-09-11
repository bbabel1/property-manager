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
// Work Order enums (per Buildium docs)
export type BuildiumWorkOrderStatus = 'New' | 'InProgress' | 'Completed' | 'Cancelled';
export type BuildiumWorkOrderPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type BuildiumWebhookEventType = 
  | 'PropertyCreated' | 'PropertyUpdated' | 'PropertyDeleted'
  | 'UnitCreated' | 'UnitUpdated' | 'UnitDeleted'
  | 'OwnerCreated' | 'OwnerUpdated' | 'OwnerDeleted'
  | 'LeaseCreated' | 'LeaseUpdated' | 'LeaseDeleted'
  | 'BillCreated' | 'BillUpdated' | 'BillPaid'
  | 'TaskCreated' | 'TaskUpdated' | 'TaskCompleted';
export type BuildiumSyncStatusType = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

// ============================================================================
// GENERAL LEDGER TYPES (Accounts, Entries, Transactions)
// ============================================================================

export type BuildiumGLAccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type BuildiumGLAccountSubType =
  | 'Cash'
  | 'AccountsReceivable'
  | 'AccountsPayable'
  | 'PrepaidExpense'
  | 'AccumulatedDepreciation'
  | 'CommonStock'
  | 'RetainedEarnings'
  | 'Revenue'
  | 'Expense'
  | string; // allow future/unknown subtypes

export type BuildiumGLPostingType = 'Credit' | 'Debit';
export type BuildiumGLCashFlowClassification = 'Operating' | 'Investing' | 'Financing';
export type BuildiumAccountingEntityType = 'Association' | 'Rental' | 'Commercial';

export interface BuildiumGLSubAccountRef {
  Id: number;
  AccountNumber?: string;
  Name?: string;
  Href?: string;
}

export interface BuildiumAccountingEntityRef {
  Id?: number; // Property Id when Rental/Association/Commercial
  AccountingEntityType?: BuildiumAccountingEntityType;
  UnitId?: number | null;
}

export interface BuildiumGLAccount {
  Id: number;
  AccountNumber?: string;
  Name: string;
  Description?: string;
  Type: BuildiumGLAccountType;
  SubType?: BuildiumGLAccountSubType;
  IsDefaultGLAccount?: boolean;
  DefaultAccountName?: string;
  IsContraAccount?: boolean;
  IsBankAccount?: boolean;
  CashFlowClassification?: BuildiumGLCashFlowClassification;
  ExcludeFromCashBalances?: boolean;
  IsActive?: boolean;
  ParentGLAccountId?: number | null;
  IsCreditCardAccount?: boolean;
  SubAccounts?: BuildiumGLSubAccountRef[];
  CreatedDateTime?: string;
  LastUpdatedDateTime?: string;
}

export interface BuildiumGLEntryLine {
  Id?: number;
  GLAccountId: number;
  Amount: number;
  PostingType: BuildiumGLPostingType;
  Memo?: string;
  AccountingEntity?: BuildiumAccountingEntityRef;
}

export interface BuildiumGLEntry {
  Id: number;
  Date: string; // yyyy-mm-dd
  TransactionType?: string;
  TotalAmount?: number;
  CheckNumber?: string;
  Memo?: string;
  Lines: BuildiumGLEntryLine[];
  CreatedDateTime?: string; // ISO 8601
  LastUpdatedDateTime?: string; // ISO 8601
}

export interface BuildiumGLTransaction {
  Id: number;
  Date: string;
  TransactionType?: string;
  TotalAmount: number;
  CheckNumber?: string;
  Lines?: BuildiumGLEntryLine[];
}

export interface BuildiumGLAccountBalance {
  GLAccountId: number;
  AsOfDate: string; // yyyy-mm-dd
  BeginningBalance: number;
  Debits: number;
  Credits: number;
  EndingBalance: number;
  NetChange: number;
}

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

// Per Buildium v1 Rental Units docs
export type BuildiumUnitBedrooms =
  | 'NotSet'
  | 'Studio'
  | 'OneBed'
  | 'TwoBed'
  | 'ThreeBed'
  | 'FourBed'
  | 'FiveBed'
  | 'SixBed'
  | 'SevenBed'
  | 'EightBed'
  | 'NineBedPlus'

export type BuildiumUnitBathrooms =
  | 'NotSet'
  | 'OneBath'
  | 'OnePointFiveBath'
  | 'TwoBath'
  | 'TwoPointFiveBath'
  | 'ThreeBath'
  | 'ThreePointFiveBath'
  | 'FourBath'
  | 'FourPointFiveBath'
  | 'FiveBath'
  | 'FivePlusBath'

export interface BuildiumAddress {
  AddressLine1?: string
  AddressLine2?: string
  AddressLine3?: string
  City?: string
  State?: string
  PostalCode?: string
  Country?: string
}

export interface BuildiumUnit {
  Id: number
  PropertyId: number
  BuildingName?: string
  UnitNumber: string
  Description?: string
  MarketRent?: number
  Address?: BuildiumAddress
  UnitBedrooms?: BuildiumUnitBedrooms
  UnitBathrooms?: BuildiumUnitBathrooms
  UnitSize?: number
  IsUnitListed?: boolean
  IsUnitOccupied?: boolean
  Href?: string
}

export interface BuildiumUnitCreate {
  UnitNumber: string
  PropertyId: number
  UnitSize?: number
  MarketRent?: number
  Address?: BuildiumAddress
  UnitBedrooms?: BuildiumUnitBedrooms
  UnitBathrooms?: BuildiumUnitBathrooms
  Description?: string
}

export interface BuildiumUnitUpdate extends Partial<BuildiumUnitCreate> {}

// ============================================================================
// UNIT IMAGE + FILE TYPES
// ============================================================================

export interface BuildiumUnitImage {
  Id: number
  Name?: string
  Description?: string
  FileType?: string
  FileSize?: number
  IsPrivate?: boolean
  CreatedDateTime?: string
  Href?: string
}

export interface BuildiumFileDownloadMessage {
  DownloadUrl: string
  ExpirationDateTime: string
}

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
    AddressLine3?: string;
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
    AddressLine3?: string;
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
  UnitId: number;
  UnitNumber: string;
  LeaseFromDate: string; // ISO 8601
  LeaseToDate: string; // ISO 8601
  LeaseType: string;
  LeaseStatus: string;
  IsEvictionPending: boolean;
  TermType: string;
  RenewalOfferStatus: string;
  CurrentNumberOfOccupants: number;
  AccountDetails: {
    SecurityDeposit: number;
    Rent: number;
  };
  AutomaticallyMoveOutTenants: boolean;
  CreatedDateTime: string; // ISO 8601
  LastUpdatedDateTime: string; // ISO 8601
  PaymentDueDay: number;
  // Additional fields that may be present
  CurrentTenants?: any[];
  Cosigners?: any[];
  MoveOutData?: any[];
  Tenants?: Array<{
    Id: number;
    Status: string;
    MoveInDate: string;
  }>;
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
// WORK ORDER TYPES
// ============================================================================

export interface BuildiumWorkOrderCategoryRef {
  Id: number;
  Name?: string;
  Href?: string;
  SubCategory?: {
    Id: number;
    Name?: string;
  };
}

export interface BuildiumWorkOrderPropertyRef {
  Id: number;
  Type: 'Association' | 'Rental' | 'Commercial' | string;
  Href?: string;
}

export interface BuildiumWorkOrderRequestedByEntity {
  Type: 'ContactRequestor' | 'OwnerRequestor' | 'ResidentRequestor' | 'ToDoRequestor' | string;
  Id: number;
  FirstName?: string;
  LastName?: string;
  IsCompany?: boolean;
  Href?: string;
}

export interface BuildiumWorkOrder {
  Id: number;
  Category?: BuildiumWorkOrderCategoryRef;
  Title?: string; // Some docs use Title, our create schema uses Subject
  Subject?: string; // Support either for compatibility
  Description?: string;
  Property: BuildiumWorkOrderPropertyRef;
  UnitId?: number | null;
  RequestedByUserEntity?: BuildiumWorkOrderRequestedByEntity;
  AssignedToUserId?: number | null;
  WorkOrderStatus?: BuildiumWorkOrderStatus;
  Priority?: BuildiumWorkOrderPriority;
  DueDate?: string; // yyyy-mm-dd
  CreatedDateTime?: string; // ISO 8601
  LastUpdatedDateTime?: string; // ISO 8601
}

export interface BuildiumWorkOrderCreate {
  PropertyId: number;
  UnitId?: number;
  Title?: string;
  Subject?: string;
  Description: string;
  RequestedByUserEntityId?: number;
  AssignedToUserId?: number;
  Priority?: BuildiumWorkOrderPriority;
  DueDate?: string; // yyyy-mm-dd
  CategoryId?: number;
  EstimatedCost?: number;
  ScheduledDate?: string; // ISO 8601
  Category?: string;
  Notes?: string;
}

export interface BuildiumWorkOrderUpdate extends Partial<BuildiumWorkOrderCreate> {
  WorkOrderStatus?: BuildiumWorkOrderStatus;
  ActualCost?: number;
  CompletedDate?: string; // ISO 8601
}

// ============================================================================
// VENDOR TYPES
// ============================================================================

export interface BuildiumVendor {
  Id: number;
  Name: string;
  IsCompany?: boolean;
  IsActive: boolean;
  FirstName?: string;
  LastName?: string;
  PrimaryEmail?: string;
  AlternateEmail?: string;
  CompanyName?: string;
  PhoneNumber?: string;
  PhoneNumbers?:
    | Array<{ Number?: string; Type?: string }>
    | { Home?: string; Work?: string; Mobile?: string; Cell?: string; Fax?: string; Type?: string };
  Website?: string;
  Category?: { Id: number; Name?: string };
  CategoryId?: number;
  ContactName?: string;
  Email?: string;
  Address: {
    AddressLine1: string;
    AddressLine2?: string;
    AddressLine3?: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  VendorInsurance?: {
    Provider?: string;
    PolicyNumber?: string;
    ExpirationDate?: string; // ISO 8601
  };
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
  AccountNumber?: string;
  ExpenseGLAccountId?: number;
  Comments?: string;
  TaxId?: string;
  Notes?: string;
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
  // Optional detailed lines per OpenAPI spec
  Lines?: Array<{
    Id?: number;
    AccountingEntity?: {
      Id?: number; // Buildium Property Id
      AccountingEntityType?: 'Association' | 'Rental' | 'Commercial' | string;
      UnitId?: number | null;
    };
    GlAccountId?: number | null;
    Amount: number;
    Markup?: {
      Amount?: number;
      Type?: 'Percent' | 'Fixed' | string;
    };
    Memo?: string | null;
  }>;
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
  // Accept Lines for full compatibility, though creation may also support summary fields
  Lines?: Array<{
    AccountingEntity: {
      Id: number;
      AccountingEntityType: 'Association' | 'Rental' | 'Commercial' | string;
      UnitId?: number | null;
    };
    GlAccountId: number;
    Amount: number;
    Markup?: {
      Amount?: number;
      Type?: 'Percent' | 'Fixed' | string;
    };
    Memo?: string | null;
  }>;
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
// LEASE TRANSACTION TYPES
// ============================================================================

export interface BuildiumLeaseTransactionLine {
  GLAccount: { Id: number; Name?: string } | number;
  Amount: number;
  Memo?: string;
  PropertyId?: number;
  UnitId?: number;
}

export interface BuildiumLeaseTransactionJournal {
  Memo?: string;
  Lines: BuildiumLeaseTransactionLine[];
}

export interface BuildiumLeaseTransaction {
  Id: number;
  Date: string; // ISO 8601
  TransactionType?: string;
  TransactionTypeEnum?: 'Bill' | 'Charge' | 'Credit' | 'Payment' | string;
  TotalAmount: number;
  CheckNumber?: string;
  LeaseId?: number;
  PayeeTenantId?: number;
  PaymentMethod?: string;
  Journal?: BuildiumLeaseTransactionJournal;
  // Some Lease Transaction responses in v1 place lines at the top level
  Lines?: Array<{
    Id?: number;
    GLAccountId?: number;
    GLAccount?: { Id: number; Name?: string } | number;
    Amount: number;
    Memo?: string;
    IsReversed?: boolean;
    ReversedTransactionLineId?: number | null;
  }>;
}

// ============================================================================
// LEASE TRANSACTION CREATE/UPDATE (v1)
// ============================================================================

export interface BuildiumLeaseTransactionCreateLine {
  GLAccountId: number;
  Amount: number;
  Memo?: string;
}

export interface BuildiumLeaseTransactionCreate {
  TransactionType: 'Charge' | 'Payment' | 'Credit' | 'Adjustment';
  TransactionDate: string; // yyyy-mm-dd
  PostDate?: string; // yyyy-mm-dd
  Amount: number;
  Memo?: string;
  ReferenceNumber?: string;
  Lines?: BuildiumLeaseTransactionCreateLine[];
}

export type BuildiumLeaseTransactionUpdate = Partial<BuildiumLeaseTransactionCreate>;

// ============================================================================
// RECURRING TRANSACTIONS (v1)
// ============================================================================

export type BuildiumRentCycleType = 'None' | 'Monthly' | 'Weekly' | 'BiWeekly' | 'Quarterly' | 'Yearly';

export interface BuildiumRecurringTransactionCharge {
  Id?: number;
  GLAccountId: number;
  Amount: number;
  Memo?: string;
  FirstChargeDate?: string; // yyyy-mm-dd
  PostDaysInAdvance?: number;
  DueOnDayOfTheMonth?: number;
}

export interface BuildiumRecurringTransaction {
  Id: number;
  LeaseId: number;
  StartDate: string; // yyyy-mm-dd
  EndDate?: string; // yyyy-mm-dd
  TotalAmount: number;
  RentCycle: BuildiumRentCycleType | 'None';
  BackdateCharges?: boolean;
  CreatedDateTime?: string;
  CreatedByUserId?: number;
  LastUpdatedDateTime?: string;
  Charges: BuildiumRecurringTransactionCharge[];
}

export interface BuildiumRecurringTransactionCreate {
  StartDate: string; // yyyy-mm-dd
  EndDate?: string; // yyyy-mm-dd
  TotalAmount: number;
  RentCycle: BuildiumRentCycleType | 'None';
  BackdateCharges?: boolean;
  Charges: BuildiumRecurringTransactionCharge[];
}

export type BuildiumRecurringTransactionUpdate = Partial<BuildiumRecurringTransactionCreate>;

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
// TENANT TYPES
// ============================================================================

export type BuildiumMailingPreference = 'PrimaryAddress' | 'AlternateAddress'

export interface BuildiumTenantPhoneNumbers {
  Home?: string
  Work?: string
  Mobile?: string
}

export interface BuildiumTenantAddress {
  AddressLine1?: string
  AddressLine2?: string
  AddressLine3?: string
  City?: string
  State?: string
  PostalCode?: string
  Country?: string
}

export interface BuildiumTenantEmergencyContact {
  Name?: string
  RelationshipDescription?: string
  Phone?: string
  Email?: string
}

export interface BuildiumTenant {
  Id: number
  FirstName?: string
  LastName?: string
  IsCompany?: boolean
  CompanyName?: string
  DateOfBirth?: string // yyyy-mm-dd
  Email?: string
  AlternateEmail?: string
  PhoneNumbers?: BuildiumTenantPhoneNumbers | Array<{ Type?: string; Number?: string }>
  PrimaryAddress?: BuildiumTenantAddress
  AlternateAddress?: BuildiumTenantAddress
  EmergencyContact?: BuildiumTenantEmergencyContact
  Comment?: string
  MailingPreference?: BuildiumMailingPreference
  TaxId?: string
  SMSOptInStatus?: boolean
  CreatedDateTime?: string
  LastUpdatedDateTime?: string
}

export interface BuildiumTenantCreate {
  FirstName?: string
  LastName?: string
  IsCompany?: boolean
  CompanyName?: string
  DateOfBirth?: string
  Email?: string
  AlternateEmail?: string
  PhoneNumbers?: BuildiumTenantPhoneNumbers
  PrimaryAddress?: BuildiumTenantAddress
  AlternateAddress?: BuildiumTenantAddress
  EmergencyContact?: BuildiumTenantEmergencyContact
  Comment?: string
  MailingPreference?: BuildiumMailingPreference
  TaxId?: string
  SMSOptInStatus?: boolean
}

export interface BuildiumTenantUpdate extends Partial<BuildiumTenantCreate> {}

export interface BuildiumTenantNote {
  Id: number
  Subject?: string
  Note?: string
  CreatedDateTime?: string
  LastUpdatedDateTime?: string
}

export interface BuildiumTenantNoteCreate {
  Subject: string
  Note: string
}

export interface BuildiumTenantNoteUpdate extends Partial<BuildiumTenantNoteCreate> {}

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

export type BuildiumEntityType = 'property' | 'unit' | 'owner' | 'lease' | 'vendor' | 'bill' | 'task' | 'bank_account' | 'work_order';

export interface BuildiumApiConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// ============================================================================
// APPLIANCE TYPES (Rental Appliances)
// ============================================================================

export type BuildiumApplianceType =
  | 'AirConditioner'
  | 'Dishwasher'
  | 'Dryer'
  | 'Freezer'
  | 'GarbageDisposal'
  | 'Heater'
  | 'Microwave'
  | 'Oven'
  | 'Refrigerator'
  | 'Stove'
  | 'Washer'
  | 'WaterHeater'
  | 'Other';

export interface BuildiumAppliance {
  Id: number;
  PropertyId: number;
  UnitId?: number | null;
  Name: string;
  Description?: string | null;
  ApplianceType: BuildiumApplianceType;
  Manufacturer?: string | null;
  Model?: string | null;
  SerialNumber?: string | null;
  WarrantyExpirationDate?: string | null; // yyyy-mm-dd
  InstallationDate?: string | null; // yyyy-mm-dd
  IsActive?: boolean;
  CreatedDateTime?: string; // ISO 8601
  LastUpdatedDateTime?: string; // ISO 8601
}

export interface BuildiumApplianceCreate {
  PropertyId: number;
  UnitId?: number | null;
  Name: string;
  Description?: string | null;
  ApplianceType: BuildiumApplianceType;
  Manufacturer?: string | null;
  Model?: string | null;
  SerialNumber?: string | null;
  WarrantyExpirationDate?: string | null; // yyyy-mm-dd
  InstallationDate?: string | null; // yyyy-mm-dd
  IsActive?: boolean;
}

export interface BuildiumApplianceUpdate extends Partial<BuildiumApplianceCreate> {}

export type BuildiumApplianceServiceType = 'Maintenance' | 'Repair' | 'Replacement' | 'Installation' | 'Inspection' | 'Other';

export interface BuildiumApplianceServiceHistory {
  Id: number;
  ServiceDate: string; // yyyy-mm-dd
  ServiceType: BuildiumApplianceServiceType;
  Description?: string | null;
  Cost?: number | null;
  VendorName?: string | null;
  Notes?: string | null;
  CreatedDateTime?: string; // ISO 8601
  LastUpdatedDateTime?: string; // ISO 8601
}

export interface BuildiumApplianceServiceHistoryCreate {
  ServiceDate: string; // yyyy-mm-dd
  ServiceType: BuildiumApplianceServiceType;
  Description?: string | null;
  Cost?: number | null;
  VendorName?: string | null;
  Notes?: string | null;
}

export interface BuildiumApplianceServiceHistoryUpdate extends Partial<BuildiumApplianceServiceHistoryCreate> {}
