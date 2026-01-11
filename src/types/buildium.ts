// Buildium API Types
// This file contains all TypeScript types for Buildium API integration

// ============================================================================
// BASE TYPES
// ============================================================================
import type { Database } from '@/types/database';

export type BuildiumPropertyType = 'Rental' | 'Association' | 'Commercial';
export type BuildiumUnitType =
  | 'Apartment'
  | 'Condo'
  | 'House'
  | 'Townhouse'
  | 'Office'
  | 'Retail'
  | 'Warehouse'
  | 'Other';
export type BuildiumTaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type BuildiumTaskStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold';
export type BuildiumTaskRequestedByEntity = BuildiumWorkOrderRequestedByEntity;
export type BuildiumBillStatusApi =
  | 'Pending'
  | 'Paid'
  | 'Overdue'
  | 'Cancelled'
  | 'PartiallyPaid'
  | 'Approved'
  | 'PendingApproval'
  | 'Rejected'
  | 'Voided';
export type BuildiumBillStatusDb = Database['public']['Enums']['buildium_bill_status'];
// Preserve legacy alias for existing imports
export type BuildiumBillStatus = BuildiumBillStatusApi;
export type BuildiumPaymentMethod =
  | 'Check'
  | 'Cash'
  | 'CreditCard'
  | 'BankTransfer'
  | 'OnlinePayment';
export type BuildiumVendorCategory =
  | 'Contractor'
  | 'Maintenance'
  | 'Utilities'
  | 'Insurance'
  | 'Legal'
  | 'Accounting'
  | 'Marketing'
  | 'Other';
export type BuildiumBankAccountType =
  | 'Checking'
  | 'Savings'
  | 'MoneyMarket'
  | 'CertificateOfDeposit';
export type BuildiumLeaseStatus = 'Future' | 'Active' | 'Past' | 'Cancelled';
export type BuildiumLeaseType = 'Fixed' | 'FixedWithRollover' | 'MonthToMonth' | 'AtWill' | 'Other';
export type BuildiumLeaseTermType = 'Standard' | 'MonthToMonth' | 'WeekToWeek' | 'AtWill' | 'Other';
export type BuildiumLeaseRenewalStatus =
  | 'NotOffered'
  | 'Offered'
  | 'Accepted'
  | 'Declined'
  | 'Expired';
export type BuildiumLeaseContactRole = 'Tenant' | 'Cosigner' | 'Guarantor';
// Work Order enums (per Buildium docs)
export type BuildiumWorkOrderStatus = 'New' | 'InProgress' | 'Completed' | 'Cancelled';
export type BuildiumWorkOrderPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type BuildiumWebhookEventType =
  // Canonical dotted forms
  | 'Property.Created'
  | 'Property.Updated'
  | 'Property.Deleted'
  | 'Rental.Created'
  | 'Rental.Updated'
  | 'Rental.Deleted'
  | 'RentalUnit.Created'
  | 'RentalUnit.Updated'
  | 'RentalUnit.Deleted'
  | 'Owner.Created'
  | 'Owner.Updated'
  | 'Owner.Deleted'
  | 'RentalOwner.Created'
  | 'RentalOwner.Updated'
  | 'RentalOwner.Deleted'
  | 'Lease.Created'
  | 'Lease.Updated'
  | 'Lease.Deleted'
  | 'LeaseTransaction.Created'
  | 'LeaseTransaction.Updated'
  | 'LeaseTransaction.Deleted'
  | 'LeaseTenant.Created'
  | 'LeaseTenant.Updated'
  | 'LeaseTenant.Deleted'
  | 'Lease.MoveOut.Created'
  | 'Lease.MoveOut.Updated'
  | 'Lease.MoveOut.Deleted'
  | 'Bill.Created'
  | 'Bill.Updated'
  | 'Bill.Deleted'
  | 'Bill.Payment.Created'
  | 'Bill.Payment.Updated'
  | 'Bill.Payment.Deleted'
  | 'GLAccount.Created'
  | 'GLAccount.Updated'
  | 'GLAccount.Deleted'
  | 'BankAccount.Created'
  | 'BankAccount.Updated'
  | 'BankAccount.Deleted'
  | 'Task.Created'
  | 'Task.Updated'
  | 'Task.Deleted'
  | 'Task.History.Created'
  | 'Task.History.Updated'
  | 'Task.History.Deleted'
  | 'TaskCategory.Created'
  | 'TaskCategory.Updated'
  | 'TaskCategory.Deleted'
  | 'Vendor.Created'
  | 'Vendor.Updated'
  | 'Vendor.Deleted'
  | 'VendorCategory.Created'
  | 'VendorCategory.Updated'
  | 'VendorCategory.Deleted'
  | 'Vendor.Transaction.Created'
  | 'Vendor.Transaction.Updated'
  | 'Vendor.Transaction.Deleted'
  | 'WorkOrder.Created'
  | 'WorkOrder.Updated'
  | 'WorkOrder.Deleted'
  // Legacy/alias forms (kept for compatibility)
  | 'PropertyCreated'
  | 'PropertyUpdated'
  | 'PropertyDeleted'
  | 'UnitCreated'
  | 'UnitUpdated'
  | 'UnitDeleted'
  | 'OwnerCreated'
  | 'OwnerUpdated'
  | 'OwnerDeleted'
  | 'LeaseCreated'
  | 'LeaseUpdated'
  | 'LeaseDeleted'
  | 'BillCreated'
  | 'BillUpdated'
  | 'BillPaid'
  | 'TaskCreated'
  | 'TaskUpdated'
  | 'TaskCompleted';
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

export interface BuildiumGeneralJournalEntryInput {
  AccountingEntity: BuildiumAccountingEntityRef;
  Date: string;
  Memo?: string | null;
  CheckNumber?: string | null;
  TotalAmount?: number;
  Lines: BuildiumGLEntryLine[];
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
// Alias used by sync flows
export type BuildiumGLAccountExtended = BuildiumGLAccount & {
  IsSecurityDepositLiability?: boolean | null;
};

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

export type BuildiumPropertyUpdate = Partial<BuildiumPropertyCreate>;

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
  | 'NineBedPlus';

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
  | 'FivePlusBath';

export interface BuildiumAddress {
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
}

export interface BuildiumUnit {
  Id: number;
  PropertyId: number;
  BuildingName?: string;
  UnitNumber: string;
  Description?: string;
  MarketRent?: number;
  Address?: BuildiumAddress;
  UnitBedrooms?: BuildiumUnitBedrooms;
  UnitBathrooms?: BuildiumUnitBathrooms;
  UnitSize?: number;
  IsUnitListed?: boolean;
  IsUnitOccupied?: boolean;
  Href?: string;
  // Buildium audit timestamps
  CreatedDate?: string | null;
  ModifiedDate?: string | null;
}

export interface BuildiumUnitCreate {
  UnitNumber: string;
  PropertyId: number;
  UnitSize?: number;
  MarketRent?: number;
  Address?: BuildiumAddress;
  UnitBedrooms?: BuildiumUnitBedrooms;
  UnitBathrooms?: BuildiumUnitBathrooms;
  Description?: string;
}

export type BuildiumUnitUpdate = Partial<BuildiumUnitCreate>;

// ============================================================================
// UNIT IMAGE + FILE TYPES
// ============================================================================

export interface BuildiumUnitImage {
  Id: number;
  Name?: string;
  Description?: string;
  FileType?: string;
  FileSize?: number;
  IsPrivate?: boolean;
  CreatedDateTime?: string;
  Href?: string;
  SortOrder?: number;
}

export interface BuildiumFileDownloadMessage {
  DownloadUrl: string;
  ExpirationDateTime: string;
}

// ============================================================================
// FILE TYPES (Buildium Files API)
// ============================================================================

export type BuildiumFileEntityType =
  | 'Account'
  | 'Association'
  | 'AssociationOwner'
  | 'AssociationUnit'
  | 'Lease'
  | 'OwnershipAccount'
  | 'PublicAsset'
  | 'Rental'
  | 'RentalOwner'
  | 'RentalUnit'
  | 'Tenant'
  | 'Vendor';

export interface BuildiumFile {
  Id: number;
  EntityType: BuildiumFileEntityType;
  EntityId: number | null;
  FileName: string;
  Title: string;
  Description?: string | null;
  CategoryId?: number | null;
  FileType?: string;
  FileSize?: number;
  IsPrivate?: boolean;
  CreatedDateTime?: string;
  ModifiedDateTime?: string;
  Href?: string;
}

export interface BuildiumFileCategory {
  Id: number;
  Name: string;
  Description?: string | null;
  IsActive?: boolean;
  CreatedDateTime?: string;
  ModifiedDateTime?: string;
}

// File upload request (step 1: metadata)
export interface BuildiumFileUploadRequest {
  EntityType: BuildiumFileEntityType;
  EntityId: number | null;
  FileName: string;
  Title: string;
  Description?: string | null;
  CategoryId: number;
}

// File upload response (step 1: returns upload URL and form data)
export interface BuildiumFileUploadResponse {
  BucketUrl: string;
  FormData: Record<string, string>;
  PhysicalFileName: string;
}

export interface BuildiumFileShareScope {
  Tenants?: boolean;
  RentalOwners?: boolean;
  RentalOwner?: boolean;
  AssociationOwners?: boolean;
  BoardMembers?: boolean;
  Committee?: boolean;
  AllResidents?: boolean;
  AllRentalOwners?: boolean;
  WebsiteVisitors?: boolean;
  Vendor?: boolean;
  PropertyIds?: number[];
  RentalOwnerIds?: number[];
}

export interface BuildiumFileShareSettings {
  Account?: {
    AllResidents?: boolean;
    PropertyIds?: number[];
    AllRentalOwners?: boolean;
    RentalOwnerIds?: number[];
    WebsiteVisitors?: boolean;
  };
  Rental?: {
    RentalOwners?: boolean;
    Tenants?: boolean;
  };
  RentalUnit?: {
    RentalOwners?: boolean;
    Tenants?: boolean;
  };
  Lease?: {
    Tenants?: boolean;
    RentalOwners?: boolean;
  };
  Tenant?: {
    Tenants?: boolean;
    RentalOwners?: boolean;
  };
  RentalOwner?: {
    RentalOwner?: boolean;
  };
  Association?: {
    AssociationOwners?: boolean;
    BoardMembers?: boolean;
  };
  AssociationUnit?: {
    AssociationOwners?: boolean;
    BoardMembers?: boolean;
  };
  OwnershipAccount?: {
    AssociationOwners?: boolean;
    BoardMembers?: boolean;
  };
  AssociationOwner?: {
    AssociationOwner?: boolean;
  };
  Vendor?: {
    Vendor?: boolean;
  };
  Committee?: {
    AssociationOwners?: boolean;
    BoardMembers?: boolean;
    Committee?: boolean;
  };
}

export type BuildiumFileShareSettingsUpdate = Partial<BuildiumFileShareSettings>;

// ============================================================================
// PROPERTY IMAGE TYPES
// ============================================================================

// Buildium's property image payload mirrors unit image payload structure.
// We keep it separate for clarity/forward-compatibility.
export interface BuildiumPropertyImage {
  Id: number;
  Name?: string;
  Description?: string;
  FileType?: string;
  FileSize?: number;
  IsPrivate?: boolean;
  CreatedDateTime?: string;
  Href?: string;
}

export type BuildiumPropertyImageList = BuildiumPropertyImage[];

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
  PropertyIds?: number[];
}

export type BuildiumOwnerUpdate = Partial<BuildiumOwnerCreate>;

// ============================================================================
// LEASE TYPES
// ============================================================================

export interface BuildiumLeasePhoneEntry {
  Number: string;
  Type?: string;
}

export interface BuildiumLeaseAddress {
  AddressLine1: string;
  AddressLine2?: string;
  AddressLine3?: string;
  City: string;
  State: string;
  PostalCode: string;
  Country: string;
}

export interface BuildiumLeasePersonCreate {
  FirstName: string;
  LastName: string;
  Email?: string;
  PhoneNumbers?: {
    Home?: string;
    Work?: string;
    Mobile?: string;
    Fax?: string;
  };
  Address?: BuildiumLeaseAddress;
  AlternateAddress?: BuildiumLeaseAddress;
  MoveInDate?: string;
  IsCompany?: boolean;
}

export interface BuildiumLeaseRentCharge {
  Amount: number;
  GLAccountId?: number;
  NextDueDate?: string;
  Memo?: string;
}

export interface BuildiumLeaseRent {
  Id?: number;
  Cycle: string;
  Charges?: BuildiumLeaseRentCharge[];
}

export interface BuildiumLeaseSecurityDeposit {
  Amount: number;
  DueDate?: string;
  GLAccountId?: number;
  Memo?: string;
}

export type BuildiumLeasePerson = BuildiumTenant & {
  Status?: string;
  MoveInDate?: string;
  MoveOutDate?: string;
};

export interface BuildiumLeaseMoveOut {
  TenantId?: number;
  MoveOutDate?: string;
  NoticeGivenDate?: string;
  Reason?: string;
}

export interface BuildiumLease {
  Id: number;
  PropertyId: number;
  UnitId: number;
  UnitNumber: string;
  LeaseFromDate: string; // ISO 8601
  LeaseToDate: string; // ISO 8601
  LeaseType: BuildiumLeaseType;
  LeaseStatus: BuildiumLeaseStatus;
  IsEvictionPending: boolean;
  TermType: BuildiumLeaseTermType;
  RenewalOfferStatus: BuildiumLeaseRenewalStatus;
  CurrentNumberOfOccupants: number;
  AccountDetails: {
    SecurityDeposit: number;
    Rent: number;
  };
  AutomaticallyMoveOutTenants: boolean;
  AccountId?: number;
  CreatedDateTime: string; // ISO 8601
  LastUpdatedDateTime: string; // ISO 8601
  PaymentDueDay: number;
  // Additional fields that may be present
  CurrentTenants?: BuildiumLeasePerson[];
  Cosigners?: BuildiumLeasePerson[];
  MoveOutData?: BuildiumLeaseMoveOut[];
  Tenants?: BuildiumLeasePerson[];
}

export interface BuildiumLeaseCreate {
  PropertyId: number;
  UnitId?: number;
  Status: BuildiumLeaseStatus;
  LeaseFromDate: string; // ISO 8601
  LeaseToDate?: string; // ISO 8601
  LeaseType?: BuildiumLeaseType;
  TermType?: BuildiumLeaseTermType;
  RenewalOfferStatus?: BuildiumLeaseRenewalStatus;
  SendWelcomeEmail?: boolean;
  AutomaticallyMoveOutTenants?: boolean;
  CurrentNumberOfOccupants?: number;
  PaymentDueDay?: number | null;
  TenantIds?: number[];
  Tenants?: BuildiumLeasePersonCreate[];
  ApplicantIds?: number[];
  AccountDetails?: {
    Rent?: number;
    SecurityDeposit?: number;
  };
  Rent?: BuildiumLeaseRent;
  SecurityDeposit?: BuildiumLeaseSecurityDeposit;
  // Backwards compatibility fields for older payload shapes
  StartDate?: string; // ISO 8601
  EndDate?: string; // ISO 8601
  RentAmount: number;
  SecurityDepositAmount?: number;
}

export type BuildiumLeaseUpdate = Partial<BuildiumLeaseCreate>;

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
  Status?: BuildiumWorkOrderStatus;
  Priority?: BuildiumWorkOrderPriority;
  DueDate?: string; // yyyy-mm-dd
  WorkOrderDueDate?: string; // alternate
  CreatedDateTime?: string; // ISO 8601
  LastUpdatedDateTime?: string; // ISO 8601
  VendorId?: number | null;
  EstimatedCost?: number;
  ActualCost?: number;
  ScheduledDate?: string;
  CompletedDate?: string;
  VendorNotes?: string;
  WorkDetails?: string;
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

export type BuildiumVendorUpdate = Partial<BuildiumVendorCreate>;

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
  Memo?: string | null;
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
  // Memo appears in the Buildium UI; include explicitly so updates can flow to the memo field.
  Memo?: string;
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

export type BuildiumBillUpdate = Partial<BuildiumBillCreate>;

// Extended bill shape used by sync flows; mirrors the mapper-level type.
export type BuildiumBillExtended = BuildiumBill & {
  PaidDate?: string | null;
  AccountId?: number | null;
  Lines?: Array<
    (BuildiumBill['Lines'] extends Array<infer L> ? L : never) & {
      Amount?: number | null;
    }
  > | null;
};

// Bill with optional Lines payload for sync/transform helpers
export type BuildiumBillWithLines = BuildiumBill & {
  PaidDate?: string | null;
  AccountId?: number | null;
  Lines?: Array<{
    Amount?: number | string | null;
    Memo?: string | null;
    GlAccountId?: number | null;
    GLAccount?: { Id?: number | null } | number | null;
    AccountingEntity?: {
      Id?: number | null;
      AccountingEntityType?: BuildiumAccountingEntityType;
      UnitId?: number | null;
      Unit?: { Id?: number | null } | null;
    } | null;
  }>;
  WorkOrderId?: number | null;
};

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

export type BuildiumTaskUpdate = Partial<BuildiumTaskCreate>;

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
  TransactionDate?: string; // ISO 8601
  PostDate?: string; // ISO 8601
  TransactionType?: string;
  TransactionTypeEnum?: 'Bill' | 'Charge' | 'Credit' | 'Payment' | string;
  TotalAmount: number;
  Amount?: number;
  CheckNumber?: string;
  LeaseId?: number;
  PayeeTenantId?: number;
  PaymentMethod?: string;
  Memo?: string;
  Description?: string;
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
  TransactionType: 'Charge' | 'Payment' | 'Credit' | 'Adjustment' | 'Refund' | 'ApplyDeposit';
  // Buildium sometimes surfaces this alongside TransactionType; keep optional for compatibility.
  TransactionTypeEnum?: BuildiumLeaseTransactionCreate['TransactionType'] | string;
  TransactionDate: string; // yyyy-mm-dd
  PostDate?: string; // yyyy-mm-dd
  Amount: number;
  Memo?: string;
  ReferenceNumber?: string;
  Lines?: BuildiumLeaseTransactionCreateLine[];
  PaymentMethod?: BuildiumPaymentMethod | string;
  PayeeTenantId?: number;
  CheckNumber?: string;
  BankAccountId?: number;
  QueueForPrinting?: boolean;
  SendEmailReceipt?: boolean;
  PrintReceipt?: boolean;
  AddressOption?: 'Current' | 'Tenant' | 'Forwarding' | 'Custom';
  CustomAddress?: string;
  DepositAccountId?: number;
}

export type BuildiumLeaseTransactionUpdate = Partial<BuildiumLeaseTransactionCreate>;

// ============================================================================
// RECURRING TRANSACTIONS (v1)
// ============================================================================

export type BuildiumRentCycleType =
  | 'None'
  | 'Monthly'
  | 'Weekly'
  | 'BiWeekly'
  | 'Quarterly'
  | 'Yearly';

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
  Country: string;
  AccountNumber: string;
  RoutingNumber: string;
  Description?: string;
  IsActive?: boolean;
}

export type BuildiumBankAccountUpdate = Partial<BuildiumBankAccountCreate>;

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface BuildiumWebhookEvent {
  Id: string;
  EventType: BuildiumWebhookEventType;
  EntityId: number;
  EntityType: string;
  EventDate: string; // ISO 8601
  Data: Record<string, unknown>; // The actual entity data
}

export interface BuildiumWebhookPayload {
  Events: BuildiumWebhookEvent[];
}

// ============================================================================
// TENANT TYPES
// ============================================================================

export type BuildiumMailingPreference = 'PrimaryAddress' | 'AlternateAddress';

export interface BuildiumTenantPhoneNumbers {
  Home?: string;
  Work?: string;
  Mobile?: string;
}

export interface BuildiumTenantAddress {
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
}

export interface BuildiumTenantEmergencyContact {
  Name?: string;
  RelationshipDescription?: string;
  Phone?: string;
  Email?: string;
}

export interface BuildiumTenant {
  Id: number;
  FirstName?: string;
  LastName?: string;
  IsCompany?: boolean;
  CompanyName?: string;
  DateOfBirth?: string; // yyyy-mm-dd
  Email?: string;
  AlternateEmail?: string;
  PhoneNumbers?: BuildiumTenantPhoneNumbers | Array<{ Type?: string; Number?: string }>;
  PrimaryAddress?: BuildiumTenantAddress;
  AlternateAddress?: BuildiumTenantAddress;
  EmergencyContact?: BuildiumTenantEmergencyContact;
  Comment?: string;
  MailingPreference?: BuildiumMailingPreference;
  TaxId?: string;
  SMSOptInStatus?: boolean;
  CreatedDateTime?: string;
  LastUpdatedDateTime?: string;
}

export interface BuildiumTenantCreate {
  FirstName?: string;
  LastName?: string;
  IsCompany?: boolean;
  CompanyName?: string;
  DateOfBirth?: string;
  Email?: string;
  AlternateEmail?: string;
  PhoneNumbers?: BuildiumTenantPhoneNumbers;
  PrimaryAddress?: BuildiumTenantAddress;
  AlternateAddress?: BuildiumTenantAddress;
  EmergencyContact?: BuildiumTenantEmergencyContact;
  Comment?: string;
  MailingPreference?: BuildiumMailingPreference;
  TaxId?: string;
  SMSOptInStatus?: boolean;
}

export type BuildiumTenantUpdate = Partial<BuildiumTenantCreate>;

export interface BuildiumTenantNote {
  Id: number;
  Subject?: string;
  Note?: string;
  CreatedDateTime?: string;
  LastUpdatedDateTime?: string;
  IsPrivate?: boolean;
}

export interface BuildiumTenantNoteCreate {
  Subject: string;
  Note: string;
  IsPrivate?: boolean;
}

export type BuildiumTenantNoteUpdate = Partial<BuildiumTenantNoteCreate>;

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
  Details?: Record<string, unknown> | null;
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

export type BuildiumEntityType =
  | 'property'
  | 'unit'
  | 'owner'
  | 'lease'
  | 'vendor'
  | 'bill'
  | 'task'
  | 'bank_account'
  | 'work_order';

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

export type BuildiumApplianceUpdate = Partial<BuildiumApplianceCreate>;

export type BuildiumApplianceServiceType =
  | 'Maintenance'
  | 'Repair'
  | 'Replacement'
  | 'Installation'
  | 'Inspection'
  | 'Other';

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

export type BuildiumApplianceServiceHistoryUpdate =
  Partial<BuildiumApplianceServiceHistoryCreate>;
