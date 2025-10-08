import type {
  BuildiumOwner,
  BuildiumTenant,
  BuildiumPropertyImage,
  BuildiumTenantPhoneNumbers as BuildiumTenantPhoneNumberMap,
  BuildiumGLAccountType as BuildiumGLAccountTypeSource,
  BuildiumGLCashFlowClassification as BuildiumGLCashFlowClassificationSource,
  BuildiumGLSubAccountRef as BuildiumGLSubAccountRefSource,
} from '@/types/buildium'

export type {
  BuildiumProperty,
  BuildiumPropertyCreate,
  BuildiumUnit,
  BuildiumUnitCreate,
  BuildiumOwner,
  BuildiumOwnerCreate,
  BuildiumVendor,
  BuildiumVendorCreate,
  BuildiumTaskCreate,
  BuildiumBill,
  BuildiumBillCreate,
  BuildiumBillStatus,
  BuildiumBankAccountCreate,
  BuildiumLease,
  BuildiumLeaseCreate,
  BuildiumSyncStatus,
  BuildiumLeaseTransaction,
  BuildiumLeaseTransactionLine,
  BuildiumTenant,
  BuildiumBankAccount,
  BuildiumAppliance,
  BuildiumApplianceCreate,
  BuildiumApplianceUpdate,
  BuildiumApplianceType,
  BuildiumGLAccount,
  BuildiumGLEntry,
  BuildiumGLEntryLine,
  BuildiumWorkOrder,
  BuildiumWorkOrderCreate,
  BuildiumWorkOrderUpdate,
  BuildiumWorkOrderPriority,
  BuildiumWorkOrderStatus,
  BuildiumTask,
  BuildiumTaskStatus,
  BuildiumTaskRequestedByEntity,
  BuildiumPropertyImage,
} from '@/types/buildium'

export type BuildiumOwnerAddress = BuildiumOwner['Address']
export type BuildiumOwnerTaxAddress = NonNullable<BuildiumOwner['TaxInformation']>['Address'] | undefined
export type BuildiumTenantPrimaryAddress = BuildiumTenant['PrimaryAddress']
export type BuildiumTenantAlternateAddress = BuildiumTenant['AlternateAddress']
export type { BuildiumTenantPhoneNumberMap }
export type BuildiumTenantPhoneNumbers = BuildiumTenant['PhoneNumbers']
export type BuildiumPropertyImagePayload = BuildiumPropertyImage
export type BuildiumTenantPhoneEntry = { Type?: string; Number?: string }
export type BuildiumGLAccountType = BuildiumGLAccountTypeSource
export type BuildiumGLCashFlowClassification = BuildiumGLCashFlowClassificationSource
export type BuildiumGLSubAccountRef = BuildiumGLSubAccountRefSource
