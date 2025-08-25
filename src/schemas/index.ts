// Export all schemas for easy importing
export * from './property';
export * from './owner';
export * from './unit';
export * from './staff';
export * from './ownership';
export * from './bank-account';
export * from './lease';
export * from './tenant';

// Re-export commonly used types from all schemas
export type {
  PropertyCreateInput,
  PropertyUpdateInput,
  PropertyQueryInput
} from './property';

export type {
  OwnerCreateInput,
  OwnerUpdateInput,
  OwnerQueryInput,
  OwnerWithPropertiesQueryInput
} from './owner';

export type {
  UnitCreateInput,
  UnitUpdateInput,
  UnitQueryInput,
  UnitWithDetailsQueryInput
} from './unit';

export type {
  StaffCreateInput,
  StaffUpdateInput,
  StaffQueryInput,
  StaffWithPropertiesQueryInput
} from './staff';

export type {
  OwnershipCreateInput,
  OwnershipUpdateInput,
  OwnershipQueryInput,
  OwnershipWithDetailsQueryInput,
  BulkOwnershipCreateInput,
  OwnershipPercentageValidationInput
} from './ownership';

export type {
  BankAccountCreateInput,
  BankAccountUpdateInput,
  BankAccountQueryInput,
  BankAccountWithTransactionsQueryInput,
  BankAccountNumberValidationInput,
  TrustAccountCreateInput
} from './bank-account';

export type {
  LeaseCreateInput,
  LeaseUpdateInput,
  LeaseQueryInput,
  LeaseWithDetailsQueryInput,
  LeaseRenewalInput,
  LeaseTerminationInput,
  LeaseSignatureInput
} from './lease';

export type {
  TenantCreateInput,
  TenantUpdateInput,
  TenantQueryInput,
  TenantWithDetailsQueryInput,
  TenantScreeningInput,
  TenantApplicationInput
} from './tenant';
