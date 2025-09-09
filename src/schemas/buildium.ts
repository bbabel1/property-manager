import { z } from 'zod'

// Buildium Bank Account Creation Schema
// Based on: https://developer.buildium.com/#tag/Bank-Accounts/operation/ExternalApiBankAccounts_CreateBankAccount
export const BuildiumBankAccountCreateSchema = z.object({
  Name: z.string().min(1, "Bank account name is required"),
  Description: z.string().optional(),
  BankAccountType: z.enum([
    'Checking',
    'Savings', 
    'MoneyMarket',
    'CertificateOfDeposit'
  ]),
  Country: z.string().min(1, 'Country is required'),
  AccountNumber: z.string().min(1, "Account number is required"),
  RoutingNumber: z.string().min(9, "Routing number must be at least 9 digits").max(9, "Routing number must be exactly 9 digits"),
  IsActive: z.boolean().default(true),
  GLAccountId: z.number().int().positive().optional()
})

// Buildium Bank Account Update Schema
export const BuildiumBankAccountUpdateSchema = z.object({
  Name: z.string().min(1, "Bank account name is required").optional(),
  Description: z.string().optional(),
  BankAccountType: z.enum([
    'Checking',
    'Savings', 
    'MoneyMarket',
    'CertificateOfDeposit'
  ]).optional(),
  Country: z.string().min(1, 'Country is required').optional(),
  AccountNumber: z.string().min(1, "Account number is required").optional(),
  RoutingNumber: z.string().min(9, "Routing number must be at least 9 digits").max(9, "Routing number must be exactly 9 digits").optional(),
  IsActive: z.boolean().optional(),
  GLAccountId: z.number().int().positive().optional()
})

// Buildium Check Creation Schema
export const BuildiumCheckCreateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer"),
  Amount: z.number().positive("Amount must be positive"),
  PayeeName: z.string().min(1, "Payee name is required"),
  Memo: z.string().optional(),
  CheckNumber: z.string().optional(),
  Date: z.string().datetime().optional() // ISO 8601 format
})

// Buildium Deposit Creation Schema
export const BuildiumDepositCreateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer"),
  Amount: z.number().positive("Amount must be positive"),
  Description: z.string().min(1, "Description is required"),
  Date: z.string().datetime().optional() // ISO 8601 format
})

// Buildium Withdrawal Creation Schema
export const BuildiumWithdrawalCreateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer"),
  Amount: z.number().positive("Amount must be positive"),
  Description: z.string().min(1, "Description is required"),
  Date: z.string().datetime().optional() // ISO 8601 format
})

// Buildium Check Update Schema
export const BuildiumCheckUpdateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer").optional(),
  Amount: z.number().positive("Amount must be positive").optional(),
  PayeeName: z.string().min(1, "Payee name is required").optional(),
  Memo: z.string().optional(),
  CheckNumber: z.string().optional(),
  Date: z.string().datetime().optional() // ISO 8601 format
})

// Buildium Deposit Update Schema
export const BuildiumDepositUpdateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer").optional(),
  Amount: z.number().positive("Amount must be positive").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  Date: z.string().datetime().optional() // ISO 8601 format
})

// Buildium Withdrawal Update Schema
export const BuildiumWithdrawalUpdateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer").optional(),
  Amount: z.number().positive("Amount must be positive").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  Date: z.string().datetime().optional() // ISO 8601 format
})

// Buildium Bill Creation Schema
// Based on: https://developer.buildium.com/#tag/Bills
export const BuildiumBillCreateSchema = z.object({
  VendorId: z.number().int().positive("Vendor ID must be a positive integer"),
  PropertyId: z.number().int().positive("Property ID must be a positive integer").optional(),
  UnitId: z.number().int().positive("Unit ID must be a positive integer").optional(),
  Date: z.string().datetime("Date must be in ISO 8601 format"),
  DueDate: z.string().datetime("Due date must be in ISO 8601 format").optional(),
  Amount: z.number().positive("Amount must be positive"),
  Description: z.string().min(1, "Description is required"),
  ReferenceNumber: z.string().optional(),
  CategoryId: z.number().int().positive("Category ID must be a positive integer").optional(),
  IsRecurring: z.boolean().default(false),
  RecurringSchedule: z.object({
    Frequency: z.enum(['Monthly', 'Quarterly', 'Yearly']).optional(),
    EndDate: z.string().datetime().optional()
  }).optional()
})

// Buildium Bill Update Schema
export const BuildiumBillUpdateSchema = z.object({
  VendorId: z.number().int().positive("Vendor ID must be a positive integer").optional(),
  PropertyId: z.number().int().positive("Property ID must be a positive integer").optional(),
  UnitId: z.number().int().positive("Unit ID must be a positive integer").optional(),
  Date: z.string().datetime("Date must be in ISO 8601 format").optional(),
  DueDate: z.string().datetime("Due date must be in ISO 8601 format").optional(),
  Amount: z.number().positive("Amount must be positive").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  ReferenceNumber: z.string().optional(),
  CategoryId: z.number().int().positive("Category ID must be a positive integer").optional(),
  IsRecurring: z.boolean().optional(),
  RecurringSchedule: z.object({
    Frequency: z.enum(['Monthly', 'Quarterly', 'Yearly']).optional(),
    EndDate: z.string().datetime().optional()
  }).optional()
})

// Buildium Bill Patch Schema (for partial updates)
export const BuildiumBillPatchSchema = z.object({
  VendorId: z.number().int().positive("Vendor ID must be a positive integer").optional(),
  PropertyId: z.number().int().positive("Property ID must be a positive integer").optional(),
  UnitId: z.number().int().positive("Unit ID must be a positive integer").optional(),
  Date: z.string().datetime("Date must be in ISO 8601 format").optional(),
  DueDate: z.string().datetime("Due date must be in ISO 8601 format").optional(),
  Amount: z.number().positive("Amount must be positive").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  ReferenceNumber: z.string().optional(),
  CategoryId: z.number().int().positive("Category ID must be a positive integer").optional(),
  IsRecurring: z.boolean().optional(),
  RecurringSchedule: z.object({
    Frequency: z.enum(['Monthly', 'Quarterly', 'Yearly']).optional(),
    EndDate: z.string().datetime().optional()
  }).optional()
})

// Buildium Bill File Upload Schema
export const BuildiumBillFileUploadSchema = z.object({
  FileName: z.string().min(1, "File name is required"),
  FileContent: z.string().min(1, "File content is required"), // Base64 encoded
  ContentType: z.string().min(1, "Content type is required")
})

// Buildium Bill File Update Schema
export const BuildiumBillFileUpdateSchema = z.object({
  Name: z.string().min(1, 'File name is required').optional(),
  Description: z.string().optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Bill Payment Creation Schema
export const BuildiumBillPaymentCreateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer"),
  Amount: z.number().positive("Amount must be positive"),
  Date: z.string().datetime("Date must be in ISO 8601 format"),
  ReferenceNumber: z.string().optional(),
  Memo: z.string().optional()
})

// Buildium Bulk Bill Payment Creation Schema
export const BuildiumBulkBillPaymentCreateSchema = z.object({
  BankAccountId: z.number().int().positive("Bank account ID must be a positive integer"),
  Bills: z.array(z.object({
    BillId: z.number().int().positive("Bill ID must be a positive integer"),
    Amount: z.number().positive("Amount must be positive")
  })).min(1, "At least one bill must be specified"),
  Date: z.string().datetime("Date must be in ISO 8601 format"),
  ReferenceNumber: z.string().optional(),
  Memo: z.string().optional()
})

// Buildium General Ledger Entry Creation Schema (v1 /glentries)
// See: https://developer.buildium.com/#tag/General-Ledger
export const BuildiumGeneralLedgerEntryCreateSchema = z.object({
  Date: z.string().datetime("Date must be in ISO 8601 format"),
  Memo: z.string().optional(),
  Lines: z.array(z.object({
    GLAccountId: z.number().int().positive("GLAccountId must be a positive integer"),
    Amount: z.number({ required_error: "Amount is required" }),
    PostingType: z.enum(['Credit', 'Debit'], { required_error: 'PostingType is required' }),
    Memo: z.string().optional(),
    AccountingEntity: z.object({
      Id: z.number().int().positive().optional(),
      AccountingEntityType: z.enum(['Association', 'Rental', 'Commercial']).optional(),
      UnitId: z.number().int().positive().nullable().optional()
    }).optional()
  })).min(2, "At least 2 lines are required for a journal entry"),
  TransactionType: z.string().optional(),
  CheckNumber: z.string().optional()
})

// Buildium General Ledger Entry Update Schema
export const BuildiumGeneralLedgerEntryUpdateSchema = z.object({
  Date: z.string().datetime("Date must be in ISO 8601 format").optional(),
  Memo: z.string().optional(),
  Lines: z.array(z.object({
    Id: z.number().int().positive().optional(),
    GLAccountId: z.number().int().positive("GLAccountId must be a positive integer"),
    Amount: z.number({ required_error: "Amount is required" }),
    PostingType: z.enum(['Credit', 'Debit']).optional(),
    Memo: z.string().optional(),
    AccountingEntity: z.object({
      Id: z.number().int().positive().optional(),
      AccountingEntityType: z.enum(['Association', 'Rental', 'Commercial']).optional(),
      UnitId: z.number().int().positive().nullable().optional()
    }).optional()
  })).min(2, "At least 2 lines are required for a journal entry").optional(),
  TransactionType: z.string().optional(),
  CheckNumber: z.string().optional()
})

// Buildium General Ledger Account Creation Schema (v1 /glaccounts)
export const BuildiumGeneralLedgerAccountCreateSchema = z.object({
  AccountNumber: z.string().optional(),
  Name: z.string().min(1, 'Account name is required'),
  Description: z.string().optional(),
  Type: z.enum(['Asset','Liability','Equity','Revenue','Expense']),
  SubType: z.string().optional(),
  IsDefaultGLAccount: z.boolean().optional(),
  DefaultAccountName: z.string().optional(),
  IsContraAccount: z.boolean().optional(),
  IsBankAccount: z.boolean().optional(),
  CashFlowClassification: z.enum(['Operating','Investing','Financing']).optional(),
  ExcludeFromCashBalances: z.boolean().optional(),
  IsActive: z.boolean().optional(),
  ParentGLAccountId: z.number().int().positive().optional(),
  IsCreditCardAccount: z.boolean().optional()
})

// Buildium General Ledger Account Update Schema
export const BuildiumGeneralLedgerAccountUpdateSchema = z.object({
  AccountNumber: z.string().optional(),
  Name: z.string().min(1, 'Account name is required').optional(),
  Description: z.string().optional(),
  Type: z.enum(['Asset','Liability','Equity','Revenue','Expense']).optional(),
  SubType: z.string().optional(),
  IsDefaultGLAccount: z.boolean().optional(),
  DefaultAccountName: z.string().optional(),
  IsContraAccount: z.boolean().optional(),
  IsBankAccount: z.boolean().optional(),
  CashFlowClassification: z.enum(['Operating','Investing','Financing']).optional(),
  ExcludeFromCashBalances: z.boolean().optional(),
  IsActive: z.boolean().optional(),
  ParentGLAccountId: z.number().int().positive().optional(),
  IsCreditCardAccount: z.boolean().optional()
})





// Buildium Property Preferred Vendors Update Schema
export const BuildiumPropertyPreferredVendorsUpdateSchema = z.object({
  VendorIds: z.array(z.number().int().positive("Vendor ID must be a positive integer"))
})

// Buildium Property Amenities Update Schema
export const BuildiumPropertyAmenitiesUpdateSchema = z.object({
  AmenityIds: z.array(z.number().int().positive("Amenity ID must be a positive integer"))
})

// Buildium Property EPay Settings Update Schema
export const BuildiumPropertyEPaySettingsUpdateSchema = z.object({
  IsEnabled: z.boolean().optional(),
  AllowPartialPayments: z.boolean().optional(),
  MinimumPaymentAmount: z.number().positive().optional(),
  PaymentMethods: z.array(z.enum(['CreditCard', 'DebitCard', 'ACH'])).optional()
})

// Buildium Property Image Upload Schema
export const BuildiumPropertyImageUploadSchema = z.object({
  FileName: z.string().min(1, "File name is required"),
  FileData: z.string().min(1, "File data is required"),
  Description: z.string().optional()
})

// Buildium Property Image Update Schema
export const BuildiumPropertyImageUpdateSchema = z.object({
  Description: z.string().optional()
})

// Buildium Property Image Order Update Schema
export const BuildiumPropertyImageOrderUpdateSchema = z.object({
  ImageIds: z.array(z.number().int().positive("Image ID must be a positive integer"))
})

// Buildium Property Video Image Create Schema
export const BuildiumPropertyVideoImageCreateSchema = z.object({
  VideoUrl: z.string().url("Video URL must be a valid URL"),
  Description: z.string().optional()
})

// Buildium Property Note Create Schema
export const BuildiumPropertyNoteCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Body: z.string().min(1, "Body is required"),
  IsPrivate: z.boolean().default(false)
})

// Buildium Property Note Update Schema
export const BuildiumPropertyNoteUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Body: z.string().min(1, "Body is required").optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Unit Creation Schema (v1 Rentals/Units)
// See: https://developer.buildium.com/#tag/Rental-Units
export const BuildiumUnitCreateSchema = z.object({
  UnitNumber: z.string().min(1, 'Unit number is required'),
  PropertyId: z.number().int().positive('Property ID must be a positive integer'),
  UnitSize: z.number().int().positive().nullable().optional(),
  MarketRent: z.number().positive().nullable().optional(),
  Address: z
    .object({
      AddressLine1: z.string().optional(),
      AddressLine2: z.string().optional(),
      AddressLine3: z.string().optional(),
      City: z.string().optional(),
      State: z.string().optional(),
      PostalCode: z.string().optional(),
      Country: z.string().optional()
    })
    .optional(),
  UnitBedrooms: z
    .enum([
      'NotSet',
      'Studio',
      'OneBed',
      'TwoBed',
      'ThreeBed',
      'FourBed',
      'FiveBed',
      'SixBed',
      'SevenBed',
      'EightBed',
      'NineBedPlus'
    ])
    .optional(),
  UnitBathrooms: z
    .enum([
      'NotSet',
      'OneBath',
      'OnePointFiveBath',
      'TwoBath',
      'TwoPointFiveBath',
      'ThreeBath',
      'ThreePointFiveBath',
      'FourBath',
      'FourPointFiveBath',
      'FiveBath',
      'FivePlusBath'
    ])
    .optional(),
  Description: z.string().optional()
})

// Buildium Unit Update Schema
export const BuildiumUnitUpdateSchema = z.object({
  UnitNumber: z.string().min(1, 'Unit number is required').optional(),
  PropertyId: z.number().int().positive().optional(),
  UnitSize: z.number().int().positive().nullable().optional(),
  MarketRent: z.number().positive().nullable().optional(),
  Address: z
    .object({
      AddressLine1: z.string().optional(),
      AddressLine2: z.string().optional(),
      AddressLine3: z.string().optional(),
      City: z.string().optional(),
      State: z.string().optional(),
      PostalCode: z.string().optional(),
      Country: z.string().optional()
    })
    .optional(),
  UnitBedrooms: z
    .enum([
      'NotSet',
      'Studio',
      'OneBed',
      'TwoBed',
      'ThreeBed',
      'FourBed',
      'FiveBed',
      'SixBed',
      'SevenBed',
      'EightBed',
      'NineBedPlus'
    ])
    .optional(),
  UnitBathrooms: z
    .enum([
      'NotSet',
      'OneBath',
      'OnePointFiveBath',
      'TwoBath',
      'TwoPointFiveBath',
      'ThreeBath',
      'ThreePointFiveBath',
      'FourBath',
      'FourPointFiveBath',
      'FiveBath',
      'FivePlusBath'
    ])
    .optional(),
  Description: z.string().optional()
})

// Buildium Unit Amenities Update Schema
export const BuildiumUnitAmenitiesUpdateSchema = z.object({
  AmenityIds: z.array(z.number().int().positive("Amenity ID must be a positive integer"))
})

// Buildium Unit Image Upload Schema
export const BuildiumUnitImageUploadSchema = z.object({
  FileName: z.string().min(1, "File name is required"),
  FileData: z.string().min(1, "File data is required"),
  Description: z.string().optional()
})

// Buildium Unit Image Update Schema
export const BuildiumUnitImageUpdateSchema = z.object({
  Description: z.string().optional()
})

// Buildium Unit Image Order Update Schema
export const BuildiumUnitImageOrderUpdateSchema = z.object({
  ImageIds: z.array(z.number().int().positive("Image ID must be a positive integer"))
})

// Buildium Unit Video Image Create Schema
export const BuildiumUnitVideoImageCreateSchema = z.object({
  VideoUrl: z.string().url("Video URL must be a valid URL"),
  Description: z.string().optional()
})

// Buildium Unit Note Create Schema
export const BuildiumUnitNoteCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Body: z.string().min(1, "Body is required"),
  IsPrivate: z.boolean().default(false)
})

// Buildium Unit Note Update Schema
export const BuildiumUnitNoteUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Body: z.string().min(1, "Body is required").optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Appliance Creation Schema
// Based on: https://developer.buildium.com/#tag/Rental-Appliances
export const BuildiumApplianceCreateSchema = z.object({
  PropertyId: z.number().int().positive("Property ID must be a positive integer"),
  UnitId: z.number().int().positive("Unit ID must be a positive integer").optional(),
  Name: z.string().min(1, "Name is required"),
  ApplianceType: z.enum([
    'Refrigerator',
    'Dishwasher',
    'Stove',
    'Microwave',
    'Washer',
    'Dryer',
    'AirConditioner',
    'Heater',
    'WaterHeater',
    'GarbageDisposal',
    'Other'
  ]),
  Manufacturer: z.string().min(1, "Manufacturer is required"),
  Model: z.string().min(1, "Model is required"),
  SerialNumber: z.string().optional(),
  InstallationDate: z.string().datetime().optional(),
  WarrantyExpirationDate: z.string().datetime().optional(),
  Description: z.string().optional(),
  IsActive: z.boolean().default(true)
})

// Buildium Appliance Update Schema
export const BuildiumApplianceUpdateSchema = z.object({
  Name: z.string().min(1, "Name is required").optional(),
  ApplianceType: z.enum([
    'Refrigerator',
    'Dishwasher',
    'Stove',
    'Microwave',
    'Washer',
    'Dryer',
    'AirConditioner',
    'Heater',
    'WaterHeater',
    'GarbageDisposal',
    'Other'
  ]).optional(),
  Manufacturer: z.string().min(1, "Manufacturer is required").optional(),
  Model: z.string().min(1, "Model is required").optional(),
  SerialNumber: z.string().optional(),
  InstallationDate: z.string().datetime().optional(),
  WarrantyExpirationDate: z.string().datetime().optional(),
  Description: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium Appliance Service History Create Schema
export const BuildiumApplianceServiceHistoryCreateSchema = z.object({
  ServiceDate: z.string().datetime("Service date is required"),
  ServiceType: z.enum([
    'Maintenance',
    'Repair',
    'Replacement',
    'Inspection',
    'Other'
  ]),
  Description: z.string().min(1, "Description is required"),
  Cost: z.number().positive().optional(),
  VendorId: z.number().int().positive("Vendor ID must be a positive integer").optional(),
  Notes: z.string().optional()
})

// Buildium Owner Creation Schema
// Based on: https://developer.buildium.com/#tag/Rental-Owners
export const BuildiumOwnerCreateSchema = z.object({
  FirstName: z.string().min(1, "First name is required"),
  LastName: z.string().min(1, "Last name is required"),
  Email: z.string().email("Valid email is required"),
  PhoneNumber: z.string().optional(),
  Address: z.object({
    AddressLine1: z.string().min(1, "Address line 1 is required"),
    AddressLine2: z.string().optional(),
    City: z.string().min(1, "City is required"),
    State: z.string().min(1, "State is required"),
    PostalCode: z.string().min(1, "Postal code is required"),
    Country: z.string().default("United States")
  }).optional(),
  TaxId: z.string().optional(),
  IsActive: z.boolean().default(true)
})

// Buildium Owner Update Schema
export const BuildiumOwnerUpdateSchema = z.object({
  FirstName: z.string().min(1, "First name is required").optional(),
  LastName: z.string().min(1, "Last name is required").optional(),
  Email: z.string().email("Valid email is required").optional(),
  PhoneNumber: z.string().optional(),
  Address: z.object({
    AddressLine1: z.string().min(1, "Address line 1 is required"),
    AddressLine2: z.string().optional(),
    City: z.string().min(1, "City is required"),
    State: z.string().min(1, "State is required"),
    PostalCode: z.string().min(1, "Postal code is required"),
    Country: z.string().default("United States")
  }).optional(),
  TaxId: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium Owner Note Create Schema
export const BuildiumOwnerNoteCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Body: z.string().min(1, "Body is required"),
  IsPrivate: z.boolean().default(false)
})

// Buildium Owner Note Update Schema
export const BuildiumOwnerNoteUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Body: z.string().min(1, "Body is required").optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Tenant Creation Schema (v1 Rentals/Tenants)
// Matches: https://developer.buildium.com/#tag/Rental-Tenants
// Accepts Buildium-native shape so we can POST directly
export const BuildiumTenantCreateSchema = z.object({
  FirstName: z.string().min(1, 'First name is required').optional(),
  LastName: z.string().min(1, 'Last name is required').optional(),
  IsCompany: z.boolean().optional(),
  CompanyName: z.string().optional(),
  DateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/,
      'DateOfBirth must be YYYY-MM-DD')
    .optional(),
  Email: z.string().email().optional(),
  AlternateEmail: z.string().email().optional(),
  PhoneNumbers: z
    .object({
      Home: z.string().optional(),
      Work: z.string().optional(),
      Mobile: z.string().optional()
    })
    .optional(),
  PrimaryAddress: z
    .object({
      AddressLine1: z.string().optional(),
      AddressLine2: z.string().optional(),
      AddressLine3: z.string().optional(),
      City: z.string().optional(),
      State: z.string().optional(),
      PostalCode: z.string().optional(),
      Country: z.string().optional()
    })
    .optional(),
  AlternateAddress: z
    .object({
      AddressLine1: z.string().optional(),
      AddressLine2: z.string().optional(),
      AddressLine3: z.string().optional(),
      City: z.string().optional(),
      State: z.string().optional(),
      PostalCode: z.string().optional(),
      Country: z.string().optional()
    })
    .optional(),
  EmergencyContact: z
    .object({
      Name: z.string().optional(),
      RelationshipDescription: z.string().optional(),
      Phone: z.string().optional(),
      Email: z.string().email().optional()
    })
    .optional(),
  Comment: z.string().optional(),
  MailingPreference: z.enum(['PrimaryAddress', 'AlternateAddress']).optional(),
  TaxId: z.string().optional(),
  SMSOptInStatus: z.boolean().optional()
})

// Buildium Tenant Update Schema (same shape as create)
export const BuildiumTenantUpdateSchema = BuildiumTenantCreateSchema.partial()

// Buildium Tenant Note Create Schema
export const BuildiumTenantNoteCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Body: z.string().min(1, "Body is required"),
  IsPrivate: z.boolean().default(false)
})

// Buildium Tenant Note Update Schema
export const BuildiumTenantNoteUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Body: z.string().min(1, "Body is required").optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Lease Creation Schema
// Based on: https://developer.buildium.com/#tag/Leases
export const BuildiumLeaseCreateSchema = z.object({
  PropertyId: z.number().int().positive("Property ID must be a positive integer"),
  UnitId: z.number().int().positive("Unit ID must be a positive integer"),
  StartDate: z.string().datetime("Start date is required"),
  EndDate: z.string().datetime("End date is required").optional(),
  RentAmount: z.number().positive("Rent amount must be positive"),
  SecurityDepositAmount: z.number().positive("Security deposit amount must be positive").optional(),
  LeaseType: z.enum(['Standard','MonthToMonth','WeekToWeek','Other']),
  TermType: z.enum(['Fixed','MonthToMonth','WeekToWeek','Other']).optional(),
  RenewalOfferStatus: z.enum(['NotOffered','Offered','Accepted','Declined','Expired']).optional(),
  Notes: z.string().optional()
})

// Buildium Lease Update Schema
export const BuildiumLeaseUpdateSchema = z.object({
  PropertyId: z.number().int().positive("Property ID must be a positive integer").optional(),
  UnitId: z.number().int().positive("Unit ID must be a positive integer").optional(),
  StartDate: z.string().datetime("Start date is required").optional(),
  EndDate: z.string().datetime("End date is required").optional(),
  RentAmount: z.number().positive("Rent amount must be positive").optional(),
  SecurityDepositAmount: z.number().positive("Security deposit amount must be positive").optional(),
  LeaseType: z.enum(['Standard','MonthToMonth','WeekToWeek','Other']).optional(),
  TermType: z.enum(['Fixed','MonthToMonth','WeekToWeek','Other']).optional(),
  RenewalOfferStatus: z.enum(['NotOffered','Offered','Accepted','Declined','Expired']).optional(),
  Notes: z.string().optional()
})

// Buildium Lease Move Out Create Schema
export const BuildiumLeaseMoveOutCreateSchema = z.object({
  MoveOutDate: z.string().datetime("Move out date is required"),
  Reason: z.string().min(1, "Reason is required"),
  Notes: z.string().optional()
})

// Buildium Lease Note Create Schema
export const BuildiumLeaseNoteCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Body: z.string().min(1, "Body is required"),
  IsPrivate: z.boolean().default(false)
})

// Buildium Lease Note Update Schema
export const BuildiumLeaseNoteUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Body: z.string().min(1, "Body is required").optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Lease Charge Create Schema
// Based on: https://developer.buildium.com/#tag/Lease-Transactions
export const BuildiumLeaseChargeCreateSchema = z.object({
  Amount: z.number().positive("Amount must be positive"),
  Date: z.string().datetime("Date is required"),
  Description: z.string().min(1, "Description is required"),
  ChargeType: z.enum([
    'Rent',
    'LateFee',
    'NSFFee',
    'PetFee',
    'Utility',
    'Other'
  ]),
  IsRecurring: z.boolean().default(false),
  RecurringFrequency: z.enum([
    'Monthly',
    'Weekly',
    'Yearly'
  ]).optional(),
  Notes: z.string().optional()
})

// Buildium Lease Transaction Create/Update Schemas
// Mirrors: https://developer.buildium.com/#tag/Lease-Transactions
export const BuildiumLeaseTransactionCreateSchema = z.object({
  TransactionType: z.enum(['Charge', 'Payment', 'Credit', 'Adjustment']),
  TransactionDate: z.string().min(1, 'TransactionDate is required'),
  PostDate: z.string().optional(),
  Amount: z.number(),
  Memo: z.string().optional(),
  ReferenceNumber: z.string().optional(),
  Lines: z
    .array(
      z.object({
        GLAccountId: z.number().int().positive(),
        Amount: z.number(),
        Memo: z.string().optional(),
      })
    )
    .optional(),
})

export const BuildiumLeaseTransactionUpdateSchema = BuildiumLeaseTransactionCreateSchema.partial()

// Recurring Transactions (Lease)
export const BuildiumRecurringTransactionCreateSchema = z.object({
  StartDate: z.string().min(1, 'StartDate is required'),
  EndDate: z.string().optional(),
  TotalAmount: z.number(),
  RentCycle: z.enum(['None', 'Monthly', 'Weekly', 'BiWeekly', 'Quarterly', 'Yearly']),
  BackdateCharges: z.boolean().optional(),
  Charges: z.array(
    z.object({
      GLAccountId: z.number().int().positive(),
      Amount: z.number(),
      Memo: z.string().optional(),
      FirstChargeDate: z.string().optional(),
      PostDaysInAdvance: z.number().int().optional(),
      DueOnDayOfTheMonth: z.number().int().optional(),
    })
  ),
})

export const BuildiumRecurringTransactionUpdateSchema = BuildiumRecurringTransactionCreateSchema.partial()

// Buildium Lease Charge Update Schema
export const BuildiumLeaseChargeUpdateSchema = z.object({
  Amount: z.number().positive("Amount must be positive").optional(),
  Date: z.string().datetime("Date is required").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  ChargeType: z.enum([
    'Rent',
    'LateFee',
    'NSFFee',
    'PetFee',
    'Utility',
    'Other'
  ]).optional(),
  IsRecurring: z.boolean().optional(),
  RecurringFrequency: z.enum([
    'Monthly',
    'Weekly',
    'Yearly'
  ]).optional(),
  Notes: z.string().optional()
})

// Buildium Task History Update Schema
// Based on: https://developer.buildium.com/#tag/Tasks
export const BuildiumTaskHistoryUpdateSchema = z.object({
  Status: z.enum([
    'Open',
    'InProgress',
    'Completed',
    'Cancelled'
  ]).optional(),
  Notes: z.string().optional(),
  CompletedDate: z.string().datetime("Completed date is required").optional(),
  AssignedTo: z.string().optional()
})

// Buildium Task History File Upload Schema
export const BuildiumTaskHistoryFileUploadSchema = z.object({
  FileName: z.string().min(1, "File name is required"),
  FileContent: z.string().min(1, "File content is required"),
  ContentType: z.string().optional()
})

// Buildium Task Category Create Schema
export const BuildiumTaskCategoryCreateSchema = z.object({
  Name: z.string().min(1, "Category name is required"),
  Description: z.string().optional(),
  Color: z.string().optional()
})

// Buildium Task Category Update Schema
export const BuildiumTaskCategoryUpdateSchema = z.object({
  Name: z.string().min(1, "Category name is required").optional(),
  Description: z.string().optional(),
  Color: z.string().optional()
})

// Buildium Owner Request Create Schema
// Based on: https://developer.buildium.com/#tag/Rental-Owner-Requests
export const BuildiumOwnerRequestCreateSchema = z.object({
  OwnerId: z.number().int().positive("Owner ID is required"),
  PropertyId: z.number().int().positive("Property ID is required"),
  Subject: z.string().min(1, "Subject is required"),
  Description: z.string().min(1, "Description is required"),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  RequestType: z.enum([
    'Maintenance',
    'Improvement',
    'Inspection',
    'Other'
  ]).optional(),
  EstimatedCost: z.number().positive("Estimated cost must be positive").optional(),
  RequestedDate: z.string().datetime("Requested date is required").optional()
})

// Buildium Owner Request Update Schema
export const BuildiumOwnerRequestUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  RequestType: z.enum([
    'Maintenance',
    'Improvement',
    'Inspection',
    'Other'
  ]).optional(),
  Status: z.enum([
    'Open',
    'InProgress',
    'Completed',
    'Cancelled'
  ]).optional(),
  EstimatedCost: z.number().positive("Estimated cost must be positive").optional(),
  RequestedDate: z.string().datetime("Requested date is required").optional(),
  CompletedDate: z.string().datetime("Completed date is required").optional()
})

// Buildium Owner Contribution Request Update Schema
export const BuildiumOwnerContributionRequestUpdateSchema = z.object({
  ContributionAmount: z.number().positive("Contribution amount must be positive").optional(),
  ContributionPercentage: z.number().min(0).max(100, "Contribution percentage must be between 0 and 100").optional(),
  Notes: z.string().optional(),
  Status: z.enum([
    'Pending',
    'Approved',
    'Rejected'
  ]).optional()
})

// Buildium Resident Request Create Schema
// Based on: https://developer.buildium.com/#tag/Resident-Requests
export const BuildiumResidentRequestCreateSchema = z.object({
  TenantId: z.number().int().positive("Tenant ID is required"),
  PropertyId: z.number().int().positive("Property ID is required"),
  UnitId: z.number().int().positive("Unit ID is required"),
  Subject: z.string().min(1, "Subject is required"),
  Description: z.string().min(1, "Description is required"),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  RequestType: z.enum([
    'Maintenance',
    'Improvement',
    'Inspection',
    'Other'
  ]).optional(),
  EstimatedCost: z.number().positive("Estimated cost must be positive").optional(),
  RequestedDate: z.string().datetime("Requested date is required").optional()
})

// Buildium Resident Request Update Schema
export const BuildiumResidentRequestUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  RequestType: z.enum([
    'Maintenance',
    'Improvement',
    'Inspection',
    'Other'
  ]).optional(),
  Status: z.enum([
    'Open',
    'InProgress',
    'Completed',
    'Cancelled'
  ]).optional(),
  EstimatedCost: z.number().positive("Estimated cost must be positive").optional(),
  RequestedDate: z.string().datetime("Requested date is required").optional(),
  CompletedDate: z.string().datetime("Completed date is required").optional()
})

// Buildium To Do Request Create Schema
// Based on: https://developer.buildium.com/#tag/To-Do-Requests
export const BuildiumToDoRequestCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Description: z.string().min(1, "Description is required"),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  AssignedTo: z.string().optional(),
  DueDate: z.string().datetime("Due date is required").optional(),
  Category: z.string().optional(),
  Notes: z.string().optional()
})

// Buildium To Do Request Update Schema
export const BuildiumToDoRequestUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  Status: z.enum([
    'Open',
    'InProgress',
    'Completed',
    'Cancelled'
  ]).optional(),
  AssignedTo: z.string().optional(),
  DueDate: z.string().datetime("Due date is required").optional(),
  Category: z.string().optional(),
  Notes: z.string().optional(),
  CompletedDate: z.string().datetime("Completed date is required").optional()
})

// Buildium Work Order Create Schema
// Based on: https://developer.buildium.com/#tag/Work-Orders
export const BuildiumWorkOrderCreateSchema = z.object({
  PropertyId: z.number().int().positive("Property ID is required"),
  UnitId: z.number().int().positive("Unit ID is required").optional(),
  Subject: z.string().min(1, "Subject is required"),
  Description: z.string().min(1, "Description is required"),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  AssignedTo: z.string().optional(),
  EstimatedCost: z.number().positive("Estimated cost must be positive").optional(),
  ScheduledDate: z.string().datetime("Scheduled date is required").optional(),
  Category: z.string().optional(),
  Notes: z.string().optional()
})

// Buildium Work Order Update Schema
export const BuildiumWorkOrderUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Description: z.string().min(1, "Description is required").optional(),
  Priority: z.enum([
    'Low',
    'Medium',
    'High',
    'Urgent'
  ]).optional(),
  Status: z.enum([
    'Open',
    'InProgress',
    'Completed',
    'Cancelled'
  ]).optional(),
  AssignedTo: z.string().optional(),
  EstimatedCost: z.number().positive("Estimated cost must be positive").optional(),
  ActualCost: z.number().positive("Actual cost must be positive").optional(),
  ScheduledDate: z.string().datetime("Scheduled date is required").optional(),
  CompletedDate: z.string().datetime("Completed date is required").optional(),
  Category: z.string().optional(),
  Notes: z.string().optional()
})

// Buildium Vendor Create Schema
// Based on: https://developer.buildium.com/#tag/Vendors
export const BuildiumVendorCreateSchema = z.object({
  Name: z.string().min(1, "Vendor name is required"),
  CategoryId: z.number().int().positive("Category ID is required"),
  ContactName: z.string().optional(),
  Email: z.string().email("Invalid email format").optional(),
  PhoneNumber: z.string().optional(),
  Address: z.object({
    AddressLine1: z.string().optional(),
    AddressLine2: z.string().optional(),
    City: z.string().optional(),
    State: z.string().optional(),
    PostalCode: z.string().optional(),
    Country: z.string().optional()
  }).optional(),
  TaxId: z.string().optional(),
  Notes: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium Vendor Update Schema
export const BuildiumVendorUpdateSchema = z.object({
  Name: z.string().min(1, "Vendor name is required").optional(),
  CategoryId: z.number().int().positive("Category ID is required").optional(),
  ContactName: z.string().optional(),
  Email: z.string().email("Invalid email format").optional(),
  PhoneNumber: z.string().optional(),
  Address: z.object({
    AddressLine1: z.string().optional(),
    AddressLine2: z.string().optional(),
    City: z.string().optional(),
    State: z.string().optional(),
    PostalCode: z.string().optional(),
    Country: z.string().optional()
  }).optional(),
  TaxId: z.string().optional(),
  Notes: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium Vendor Credit Create Schema
export const BuildiumVendorCreditCreateSchema = z.object({
  Amount: z.number().positive("Amount must be positive"),
  Date: z.string().datetime("Date is required"),
  Description: z.string().min(1, "Description is required"),
  ReferenceNumber: z.string().optional(),
  Notes: z.string().optional()
})

// Buildium Vendor Note Create Schema
export const BuildiumVendorNoteCreateSchema = z.object({
  Subject: z.string().min(1, "Subject is required"),
  Note: z.string().min(1, "Note content is required"),
  IsPrivate: z.boolean().optional()
})

// Buildium Vendor Note Update Schema
export const BuildiumVendorNoteUpdateSchema = z.object({
  Subject: z.string().min(1, "Subject is required").optional(),
  Note: z.string().min(1, "Note content is required").optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium Vendor Refund Create Schema
export const BuildiumVendorRefundCreateSchema = z.object({
  Amount: z.number().positive("Amount must be positive"),
  Date: z.string().datetime("Date is required"),
  Description: z.string().min(1, "Description is required"),
  ReferenceNumber: z.string().optional(),
  Notes: z.string().optional()
})

// Buildium Vendor Category Create Schema
export const BuildiumVendorCategoryCreateSchema = z.object({
  Name: z.string().min(1, "Category name is required"),
  Description: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium Vendor Category Update Schema
export const BuildiumVendorCategoryUpdateSchema = z.object({
  Name: z.string().min(1, "Category name is required").optional(),
  Description: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium File Upload Schema
// Based on: https://developer.buildium.com/#tag/Files
export const BuildiumFileUploadSchema = z.object({
  Name: z.string().min(1, "File name is required"),
  CategoryId: z.number().int().positive("Category ID is required").optional(),
  Description: z.string().optional(),
  FileData: z.string().min(1, "File data is required"),
  FileType: z.string().min(1, "File type is required"),
  IsPrivate: z.boolean().optional()
})

// Buildium File Update Schema
export const BuildiumFileUpdateSchema = z.object({
  Name: z.string().min(1, "File name is required").optional(),
  CategoryId: z.number().int().positive("Category ID is required").optional(),
  Description: z.string().optional(),
  IsPrivate: z.boolean().optional()
})

// Buildium File Share Settings Update Schema
export const BuildiumFileShareSettingsUpdateSchema = z.object({
  IsPublic: z.boolean().optional(),
  AllowDownload: z.boolean().optional(),
  AllowView: z.boolean().optional(),
  ExpirationDate: z.string().datetime("Expiration date must be in ISO 8601 format").optional()
})

// Buildium File Category Create Schema
export const BuildiumFileCategoryCreateSchema = z.object({
  Name: z.string().min(1, "Category name is required"),
  Description: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium File Category Update Schema
export const BuildiumFileCategoryUpdateSchema = z.object({
  Name: z.string().min(1, "Category name is required").optional(),
  Description: z.string().optional(),
  IsActive: z.boolean().optional()
})

// Buildium Partial Payment Settings Update Schema
// Based on: https://developer.buildium.com/#tag/Administration
export const BuildiumPartialPaymentSettingsUpdateSchema = z.object({
  AllowPartialPayments: z.boolean().optional(),
  MinimumPaymentAmount: z.number().positive("Minimum payment amount must be positive").optional(),
  PartialPaymentFee: z.number().positive("Partial payment fee must be positive").optional(),
  PartialPaymentFeeType: z.enum(['Fixed', 'Percentage']).optional(),
  ApplyFeeToAllPartialPayments: z.boolean().optional()
})

// TypeScript types derived from schemas
export type BuildiumBankAccountCreateInput = z.infer<typeof BuildiumBankAccountCreateSchema>
export type BuildiumBankAccountUpdateInput = z.infer<typeof BuildiumBankAccountUpdateSchema>
export type BuildiumCheckCreateInput = z.infer<typeof BuildiumCheckCreateSchema>
export type BuildiumCheckUpdateInput = z.infer<typeof BuildiumCheckUpdateSchema>
export type BuildiumDepositCreateInput = z.infer<typeof BuildiumDepositCreateSchema>
export type BuildiumDepositUpdateInput = z.infer<typeof BuildiumDepositUpdateSchema>
export type BuildiumWithdrawalCreateInput = z.infer<typeof BuildiumWithdrawalCreateSchema>
export type BuildiumWithdrawalUpdateInput = z.infer<typeof BuildiumWithdrawalUpdateSchema>
export type BuildiumBillCreateInput = z.infer<typeof BuildiumBillCreateSchema>
export type BuildiumBillUpdateInput = z.infer<typeof BuildiumBillUpdateSchema>
export type BuildiumBillPatchInput = z.infer<typeof BuildiumBillPatchSchema>
export type BuildiumBillFileUploadInput = z.infer<typeof BuildiumBillFileUploadSchema>
export type BuildiumBillPaymentCreateInput = z.infer<typeof BuildiumBillPaymentCreateSchema>
export type BuildiumBulkBillPaymentCreateInput = z.infer<typeof BuildiumBulkBillPaymentCreateSchema>
export type BuildiumGeneralLedgerEntryCreateInput = z.infer<typeof BuildiumGeneralLedgerEntryCreateSchema>
export type BuildiumGeneralLedgerEntryUpdateInput = z.infer<typeof BuildiumGeneralLedgerEntryUpdateSchema>
export type BuildiumGeneralLedgerAccountCreateInput = z.infer<typeof BuildiumGeneralLedgerAccountCreateSchema>
export type BuildiumGeneralLedgerAccountUpdateInput = z.infer<typeof BuildiumGeneralLedgerAccountUpdateSchema>

export type BuildiumPropertyPreferredVendorsUpdateInput = z.infer<typeof BuildiumPropertyPreferredVendorsUpdateSchema>
export type BuildiumPropertyAmenitiesUpdateInput = z.infer<typeof BuildiumPropertyAmenitiesUpdateSchema>
export type BuildiumPropertyEPaySettingsUpdateInput = z.infer<typeof BuildiumPropertyEPaySettingsUpdateSchema>
export type BuildiumPropertyImageUploadInput = z.infer<typeof BuildiumPropertyImageUploadSchema>
export type BuildiumPropertyImageUpdateInput = z.infer<typeof BuildiumPropertyImageUpdateSchema>
export type BuildiumPropertyImageOrderUpdateInput = z.infer<typeof BuildiumPropertyImageOrderUpdateSchema>
export type BuildiumPropertyVideoImageCreateInput = z.infer<typeof BuildiumPropertyVideoImageCreateSchema>
export type BuildiumPropertyNoteCreateInput = z.infer<typeof BuildiumPropertyNoteCreateSchema>
export type BuildiumPropertyNoteUpdateInput = z.infer<typeof BuildiumPropertyNoteUpdateSchema>
export type BuildiumUnitCreateInput = z.infer<typeof BuildiumUnitCreateSchema>
export type BuildiumUnitUpdateInput = z.infer<typeof BuildiumUnitUpdateSchema>
export type BuildiumUnitAmenitiesUpdateInput = z.infer<typeof BuildiumUnitAmenitiesUpdateSchema>
export type BuildiumUnitImageUploadInput = z.infer<typeof BuildiumUnitImageUploadSchema>
export type BuildiumUnitImageUpdateInput = z.infer<typeof BuildiumUnitImageUpdateSchema>
export type BuildiumUnitImageOrderUpdateInput = z.infer<typeof BuildiumUnitImageOrderUpdateSchema>
export type BuildiumUnitVideoImageCreateInput = z.infer<typeof BuildiumUnitVideoImageCreateSchema>
export type BuildiumUnitNoteCreateInput = z.infer<typeof BuildiumUnitNoteCreateSchema>
export type BuildiumUnitNoteUpdateInput = z.infer<typeof BuildiumUnitNoteUpdateSchema>
export type BuildiumApplianceCreateInput = z.infer<typeof BuildiumApplianceCreateSchema>
export type BuildiumApplianceUpdateInput = z.infer<typeof BuildiumApplianceUpdateSchema>
export type BuildiumApplianceServiceHistoryCreateInput = z.infer<typeof BuildiumApplianceServiceHistoryCreateSchema>
export type BuildiumOwnerCreateInput = z.infer<typeof BuildiumOwnerCreateSchema>
export type BuildiumOwnerUpdateInput = z.infer<typeof BuildiumOwnerUpdateSchema>
export type BuildiumOwnerNoteCreateInput = z.infer<typeof BuildiumOwnerNoteCreateSchema>
export type BuildiumOwnerNoteUpdateInput = z.infer<typeof BuildiumOwnerNoteUpdateSchema>
export type BuildiumTenantCreateInput = z.infer<typeof BuildiumTenantCreateSchema>
export type BuildiumTenantUpdateInput = z.infer<typeof BuildiumTenantUpdateSchema>
export type BuildiumTenantNoteCreateInput = z.infer<typeof BuildiumTenantNoteCreateSchema>
export type BuildiumTenantNoteUpdateInput = z.infer<typeof BuildiumTenantNoteUpdateSchema>
export type BuildiumLeaseCreateInput = z.infer<typeof BuildiumLeaseCreateSchema>
export type BuildiumLeaseUpdateInput = z.infer<typeof BuildiumLeaseUpdateSchema>
export type BuildiumLeaseMoveOutCreateInput = z.infer<typeof BuildiumLeaseMoveOutCreateSchema>
export type BuildiumLeaseNoteCreateInput = z.infer<typeof BuildiumLeaseNoteCreateSchema>
export type BuildiumLeaseNoteUpdateInput = z.infer<typeof BuildiumLeaseNoteUpdateSchema>
export type BuildiumLeaseChargeCreateInput = z.infer<typeof BuildiumLeaseChargeCreateSchema>
export type BuildiumLeaseChargeUpdateInput = z.infer<typeof BuildiumLeaseChargeUpdateSchema>
export type BuildiumLeaseTransactionCreateInput = z.infer<typeof BuildiumLeaseTransactionCreateSchema>
export type BuildiumLeaseTransactionUpdateInput = z.infer<typeof BuildiumLeaseTransactionUpdateSchema>
export type BuildiumRecurringTransactionCreateInput = z.infer<typeof BuildiumRecurringTransactionCreateSchema>
export type BuildiumRecurringTransactionUpdateInput = z.infer<typeof BuildiumRecurringTransactionUpdateSchema>
export type BuildiumTaskHistoryUpdateInput = z.infer<typeof BuildiumTaskHistoryUpdateSchema>
export type BuildiumTaskHistoryFileUploadInput = z.infer<typeof BuildiumTaskHistoryFileUploadSchema>
export type BuildiumTaskCategoryCreateInput = z.infer<typeof BuildiumTaskCategoryCreateSchema>
export type BuildiumTaskCategoryUpdateInput = z.infer<typeof BuildiumTaskCategoryUpdateSchema>
export type BuildiumOwnerRequestCreateInput = z.infer<typeof BuildiumOwnerRequestCreateSchema>
export type BuildiumOwnerRequestUpdateInput = z.infer<typeof BuildiumOwnerRequestUpdateSchema>
export type BuildiumOwnerContributionRequestUpdateInput = z.infer<typeof BuildiumOwnerContributionRequestUpdateSchema>
export type BuildiumResidentRequestCreateInput = z.infer<typeof BuildiumResidentRequestCreateSchema>
export type BuildiumResidentRequestUpdateInput = z.infer<typeof BuildiumResidentRequestUpdateSchema>
export type BuildiumToDoRequestCreateInput = z.infer<typeof BuildiumToDoRequestCreateSchema>
export type BuildiumToDoRequestUpdateInput = z.infer<typeof BuildiumToDoRequestUpdateSchema>
export type BuildiumWorkOrderCreateInput = z.infer<typeof BuildiumWorkOrderCreateSchema>
export type BuildiumWorkOrderUpdateInput = z.infer<typeof BuildiumWorkOrderUpdateSchema>
export type BuildiumVendorCreateInput = z.infer<typeof BuildiumVendorCreateSchema>
export type BuildiumVendorUpdateInput = z.infer<typeof BuildiumVendorUpdateSchema>
export type BuildiumVendorCreditCreateInput = z.infer<typeof BuildiumVendorCreditCreateSchema>
export type BuildiumVendorNoteCreateInput = z.infer<typeof BuildiumVendorNoteCreateSchema>
export type BuildiumVendorNoteUpdateInput = z.infer<typeof BuildiumVendorNoteUpdateSchema>
export type BuildiumVendorRefundCreateInput = z.infer<typeof BuildiumVendorRefundCreateSchema>
export type BuildiumVendorCategoryCreateInput = z.infer<typeof BuildiumVendorCategoryCreateSchema>
export type BuildiumVendorCategoryUpdateInput = z.infer<typeof BuildiumVendorCategoryUpdateSchema>
export type BuildiumFileUploadInput = z.infer<typeof BuildiumFileUploadSchema>
export type BuildiumFileUpdateInput = z.infer<typeof BuildiumFileUpdateSchema>
export type BuildiumFileShareSettingsUpdateInput = z.infer<typeof BuildiumFileShareSettingsUpdateSchema>
export type BuildiumFileCategoryCreateInput = z.infer<typeof BuildiumFileCategoryCreateSchema>
export type BuildiumFileCategoryUpdateInput = z.infer<typeof BuildiumFileCategoryUpdateSchema>
export type BuildiumPartialPaymentSettingsUpdateInput = z.infer<typeof BuildiumPartialPaymentSettingsUpdateSchema>

// Export all schemas
export const BuildiumSchemas = {
  BankAccountCreate: BuildiumBankAccountCreateSchema,
  BankAccountUpdate: BuildiumBankAccountUpdateSchema,
  CheckCreate: BuildiumCheckCreateSchema,
  CheckUpdate: BuildiumCheckUpdateSchema,
  DepositCreate: BuildiumDepositCreateSchema,
  DepositUpdate: BuildiumDepositUpdateSchema,
  WithdrawalCreate: BuildiumWithdrawalCreateSchema,
  WithdrawalUpdate: BuildiumWithdrawalUpdateSchema,
  BillCreate: BuildiumBillCreateSchema,
  BillUpdate: BuildiumBillUpdateSchema,
  BillPatch: BuildiumBillPatchSchema,
  BillFileUpload: BuildiumBillFileUploadSchema,
  BillPaymentCreate: BuildiumBillPaymentCreateSchema,
  BulkBillPaymentCreate: BuildiumBulkBillPaymentCreateSchema,
  GeneralLedgerEntryCreate: BuildiumGeneralLedgerEntryCreateSchema,
  GeneralLedgerEntryUpdate: BuildiumGeneralLedgerEntryUpdateSchema,
  GeneralLedgerAccountCreate: BuildiumGeneralLedgerAccountCreateSchema,
  GeneralLedgerAccountUpdate: BuildiumGeneralLedgerAccountUpdateSchema,

  PropertyPreferredVendorsUpdate: BuildiumPropertyPreferredVendorsUpdateSchema,
  PropertyAmenitiesUpdate: BuildiumPropertyAmenitiesUpdateSchema,
  PropertyEPaySettingsUpdate: BuildiumPropertyEPaySettingsUpdateSchema,
  PropertyImageUpload: BuildiumPropertyImageUploadSchema,
  PropertyImageUpdate: BuildiumPropertyImageUpdateSchema,
  PropertyImageOrderUpdate: BuildiumPropertyImageOrderUpdateSchema,
  PropertyVideoImageCreate: BuildiumPropertyVideoImageCreateSchema,
  PropertyNoteCreate: BuildiumPropertyNoteCreateSchema,
  PropertyNoteUpdate: BuildiumPropertyNoteUpdateSchema,
  UnitCreate: BuildiumUnitCreateSchema,
  UnitUpdate: BuildiumUnitUpdateSchema,
  UnitAmenitiesUpdate: BuildiumUnitAmenitiesUpdateSchema,
  UnitImageUpload: BuildiumUnitImageUploadSchema,
  UnitImageUpdate: BuildiumUnitImageUpdateSchema,
  UnitImageOrderUpdate: BuildiumUnitImageOrderUpdateSchema,
  UnitVideoImageCreate: BuildiumUnitVideoImageCreateSchema,
  UnitNoteCreate: BuildiumUnitNoteCreateSchema,
  UnitNoteUpdate: BuildiumUnitNoteUpdateSchema,
  ApplianceCreate: BuildiumApplianceCreateSchema,
  ApplianceUpdate: BuildiumApplianceUpdateSchema,
  ApplianceServiceHistoryCreate: BuildiumApplianceServiceHistoryCreateSchema,
  OwnerCreate: BuildiumOwnerCreateSchema,
  OwnerUpdate: BuildiumOwnerUpdateSchema,
  OwnerNoteCreate: BuildiumOwnerNoteCreateSchema,
  OwnerNoteUpdate: BuildiumOwnerNoteUpdateSchema,
  TenantCreate: BuildiumTenantCreateSchema,
  TenantUpdate: BuildiumTenantUpdateSchema,
  TenantNoteCreate: BuildiumTenantNoteCreateSchema,
  TenantNoteUpdate: BuildiumTenantNoteUpdateSchema,
  LeaseCreate: BuildiumLeaseCreateSchema,
  LeaseUpdate: BuildiumLeaseUpdateSchema,
  LeaseMoveOutCreate: BuildiumLeaseMoveOutCreateSchema,
  LeaseNoteCreate: BuildiumLeaseNoteCreateSchema,
  LeaseNoteUpdate: BuildiumLeaseNoteUpdateSchema,
  LeaseChargeCreate: BuildiumLeaseChargeCreateSchema,
  LeaseChargeUpdate: BuildiumLeaseChargeUpdateSchema,
  LeaseTransactionCreate: BuildiumLeaseTransactionCreateSchema,
  LeaseTransactionUpdate: BuildiumLeaseTransactionUpdateSchema,
  RecurringTransactionCreate: BuildiumRecurringTransactionCreateSchema,
  RecurringTransactionUpdate: BuildiumRecurringTransactionUpdateSchema,
  TaskHistoryUpdate: BuildiumTaskHistoryUpdateSchema,
  TaskHistoryFileUpload: BuildiumTaskHistoryFileUploadSchema,
  TaskCategoryCreate: BuildiumTaskCategoryCreateSchema,
  TaskCategoryUpdate: BuildiumTaskCategoryUpdateSchema,
  OwnerRequestCreate: BuildiumOwnerRequestCreateSchema,
  OwnerRequestUpdate: BuildiumOwnerRequestUpdateSchema,
  OwnerContributionRequestUpdate: BuildiumOwnerContributionRequestUpdateSchema,
  ResidentRequestCreate: BuildiumResidentRequestCreateSchema,
  ResidentRequestUpdate: BuildiumResidentRequestUpdateSchema,
  ToDoRequestCreate: BuildiumToDoRequestCreateSchema,
  ToDoRequestUpdate: BuildiumToDoRequestUpdateSchema,
  WorkOrderCreate: BuildiumWorkOrderCreateSchema,
  WorkOrderUpdate: BuildiumWorkOrderUpdateSchema,
  VendorCreate: BuildiumVendorCreateSchema,
  VendorUpdate: BuildiumVendorUpdateSchema,
  VendorCreditCreate: BuildiumVendorCreditCreateSchema,
  VendorNoteCreate: BuildiumVendorNoteCreateSchema,
  VendorNoteUpdate: BuildiumVendorNoteUpdateSchema,
  VendorRefundCreate: BuildiumVendorRefundCreateSchema,
  VendorCategoryCreate: BuildiumVendorCategoryCreateSchema,
  VendorCategoryUpdate: BuildiumVendorCategoryUpdateSchema,
  FileUpload: BuildiumFileUploadSchema,
  FileUpdate: BuildiumFileUpdateSchema,
  FileShareSettingsUpdate: BuildiumFileShareSettingsUpdateSchema,
  FileCategoryCreate: BuildiumFileCategoryCreateSchema,
  FileCategoryUpdate: BuildiumFileCategoryUpdateSchema,
  PartialPaymentSettingsUpdate: BuildiumPartialPaymentSettingsUpdateSchema
}

// ============================================================================
// ENHANCED SCHEMAS FOR COMPREHENSIVE INTEGRATION
// ============================================================================

// Enhanced Property Create Schema with all Buildium fields
export const BuildiumPropertyCreateEnhancedSchema = z.object({
  Name: z.string().min(1, "Property name is required").max(255, "Property name too long"),
  PropertyType: z.enum(['Rental', 'Association', 'Commercial']),
  Address: z.object({
    AddressLine1: z.string().min(1, "Address line 1 is required").max(255),
    AddressLine2: z.string().max(255).optional(),
    City: z.string().min(1, "City is required").max(100),
    State: z.string().min(1, "State is required").max(100),
    PostalCode: z.string().min(1, "Postal code is required").max(20),
    Country: z.string().min(1, "Country is required").max(100)
  }),
  YearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  SquareFootage: z.number().int().positive("Square footage must be positive").optional(),
  Bedrooms: z.number().int().min(0).max(50).optional(),
  Bathrooms: z.number().min(0).max(50).optional(),
  IsActive: z.boolean().default(true),
  Description: z.string().max(1000).optional(),
  OperatingBankAccountId: z.number().int().positive().optional(),
  Reserve: z.number().min(0).optional()
});

// Enhanced Property Update Schema (all fields optional for updates)
export const BuildiumPropertyUpdateEnhancedSchema = z.object({
  Name: z.string().min(1, "Property name is required").max(255, "Property name too long").optional(),
  PropertyType: z.enum(['Rental', 'Association', 'Commercial']).optional(),
  Address: z.object({
    AddressLine1: z.string().min(1, "Address line 1 is required").max(255),
    AddressLine2: z.string().max(255).optional(),
    City: z.string().min(1, "City is required").max(100),
    State: z.string().min(1, "State is required").max(100),
    PostalCode: z.string().min(1, "Postal code is required").max(20),
    Country: z.string().min(1, "Country is required").max(100)
  }).optional(),
  YearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  SquareFootage: z.number().int().positive("Square footage must be positive").optional(),
  Bedrooms: z.number().int().min(0).max(50).optional(),
  Bathrooms: z.number().min(0).max(50).optional(),
  IsActive: z.boolean().optional(),
  Description: z.string().max(1000).optional(),
  OperatingBankAccountId: z.number().int().positive().optional(),
  Reserve: z.number().min(0).optional()
});

// Enhanced Unit Create Schema
export const BuildiumUnitCreateEnhancedSchema = z.object({
  PropertyId: z.number().int().positive("Property ID must be a positive integer"),
  UnitType: z.enum(['Apartment', 'Condo', 'House', 'Townhouse', 'Office', 'Retail', 'Warehouse', 'Other']),
  Number: z.string().min(1, "Unit number is required").max(50),
  SquareFootage: z.number().int().positive("Square footage must be positive").optional(),
  Bedrooms: z.number().int().min(0).max(50).optional(),
  Bathrooms: z.number().min(0).max(50).optional(),
  IsActive: z.boolean().default(true),
  Description: z.string().max(500).optional(),
  RentAmount: z.number().min(0).optional(),
  SecurityDepositAmount: z.number().min(0).optional()
});

// Enhanced Owner Create Schema
export const BuildiumOwnerCreateEnhancedSchema = z.object({
  FirstName: z.string().min(1, "First name is required").max(100),
  LastName: z.string().min(1, "Last name is required").max(100),
  Email: z.string().email("Invalid email format").max(255).optional(),
  PhoneNumber: z.string().max(50).optional(),
  Address: z.object({
    AddressLine1: z.string().min(1, "Address line 1 is required").max(255),
    AddressLine2: z.string().max(255).optional(),
    City: z.string().min(1, "City is required").max(100),
    State: z.string().min(1, "State is required").max(100),
    PostalCode: z.string().min(1, "Postal code is required").max(20),
    Country: z.string().min(1, "Country is required").max(100)
  }),
  TaxId: z.string().max(255).optional(),
  IsActive: z.boolean().default(true),
  Notes: z.string().max(1000).optional()
});

// Enhanced Vendor Create Schema
export const BuildiumVendorCreateEnhancedSchema = z.object({
  Name: z.string().min(1, "Vendor name is required").max(255),
  CategoryId: z.number().int().positive().optional(),
  ContactName: z.string().max(255).optional(),
  Email: z.string().email("Invalid email format").max(255).optional(),
  PhoneNumber: z.string().max(50).optional(),
  Address: z.object({
    AddressLine1: z.string().min(1, "Address line 1 is required").max(255),
    AddressLine2: z.string().max(255).optional(),
    City: z.string().min(1, "City is required").max(100),
    State: z.string().min(1, "State is required").max(100),
    PostalCode: z.string().min(1, "Postal code is required").max(20),
    Country: z.string().min(1, "Country is required").max(100)
  }),
  TaxId: z.string().max(255).optional(),
  Notes: z.string().max(1000).optional(),
  IsActive: z.boolean().default(true)
});

// Enhanced Task Create Schema
export const BuildiumTaskCreateEnhancedSchema = z.object({
  PropertyId: z.number().int().positive().optional(),
  UnitId: z.number().int().positive().optional(),
  Subject: z.string().min(1, "Task subject is required").max(255),
  Description: z.string().max(1000).optional(),
  Priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  Status: z.enum(['Open', 'InProgress', 'Completed', 'Cancelled', 'OnHold']).default('Open'),
  AssignedTo: z.string().max(255).optional(),
  EstimatedCost: z.number().min(0).optional(),
  ActualCost: z.number().min(0).optional(),
  ScheduledDate: z.string().datetime("Scheduled date must be in ISO 8601 format").optional(),
  CompletedDate: z.string().datetime("Completed date must be in ISO 8601 format").optional(),
  Category: z.string().max(100).optional(),
  Notes: z.string().max(1000).optional()
});

// Enhanced Bill Create Schema
export const BuildiumBillCreateEnhancedSchema = z.object({
  VendorId: z.number().int().positive("Vendor ID must be a positive integer"),
  PropertyId: z.number().int().positive().optional(),
  UnitId: z.number().int().positive().optional(),
  Date: z.string().datetime("Date must be in ISO 8601 format"),
  DueDate: z.string().datetime("Due date must be in ISO 8601 format").optional(),
  Amount: z.number().positive("Amount must be positive"),
  Description: z.string().min(1, "Description is required").max(500),
  ReferenceNumber: z.string().max(255).optional(),
  CategoryId: z.number().int().positive().optional(),
  IsRecurring: z.boolean().default(false),
  RecurringSchedule: z.object({
    Frequency: z.enum(['Monthly', 'Quarterly', 'Yearly']),
    StartDate: z.string().datetime("Start date must be in ISO 8601 format"),
    EndDate: z.string().datetime("End date must be in ISO 8601 format").optional()
  }).optional(),
  Status: z.enum(['Pending', 'Paid', 'Overdue', 'Cancelled', 'PartiallyPaid']).default('Pending')
});

// Enhanced Bank Account Create Schema
export const BuildiumBankAccountCreateEnhancedSchema = z.object({
  Name: z.string().min(1, "Bank account name is required").max(255),
  BankAccountType: z.enum(['Checking', 'Savings', 'MoneyMarket', 'CertificateOfDeposit']),
  AccountNumber: z.string().min(1, "Account number is required").max(50),
  RoutingNumber: z.string().length(9, "Routing number must be exactly 9 digits"),
  Description: z.string().max(500).optional(),
  IsActive: z.boolean().default(true)
});

// Enhanced Lease Create Schema
export const BuildiumLeaseCreateEnhancedSchema = z.object({
  PropertyId: z.number().int().positive("Property ID must be a positive integer"),
  UnitId: z.number().int().positive().optional(),
  Status: z.enum(['Future', 'Active', 'Past', 'Cancelled']),
  StartDate: z.string().datetime("Start date must be in ISO 8601 format"),
  EndDate: z.string().datetime("End date must be in ISO 8601 format").optional(),
  RentAmount: z.number().positive("Rent amount must be positive"),
  SecurityDepositAmount: z.number().min(0).optional(),
  Description: z.string().max(500).optional()
});

// Webhook Event Schema
export const BuildiumWebhookEventSchema = z.object({
  Id: z.string().min(1, "Event ID is required"),
  EventType: z.enum([
    'PropertyCreated', 'PropertyUpdated', 'PropertyDeleted',
    'UnitCreated', 'UnitUpdated', 'UnitDeleted',
    'OwnerCreated', 'OwnerUpdated', 'OwnerDeleted',
    'LeaseCreated', 'LeaseUpdated', 'LeaseDeleted',
    'BillCreated', 'BillUpdated', 'BillPaid',
    'TaskCreated', 'TaskUpdated', 'TaskCompleted'
  ]),
  EntityId: z.number().int().positive("Entity ID must be a positive integer"),
  EntityType: z.string().min(1, "Entity type is required"),
  EventDate: z.string().datetime("Event date must be in ISO 8601 format"),
  Data: z.any() // The actual entity data
});

// Webhook Payload Schema
export const BuildiumWebhookPayloadSchema = z.object({
  Events: z.array(BuildiumWebhookEventSchema).min(1, "At least one event is required")
});

// Sync Status Schema
export const BuildiumSyncStatusSchema = z.object({
  entityType: z.string().min(1, "Entity type is required"),
  entityId: z.string().uuid("Entity ID must be a valid UUID"),
  buildiumId: z.number().int().positive().optional(),
  lastSyncedAt: z.string().datetime("Last synced date must be in ISO 8601 format").optional(),
  syncStatus: z.enum(['pending', 'syncing', 'synced', 'failed', 'conflict']),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime("Created date must be in ISO 8601 format"),
  updatedAt: z.string().datetime("Updated date must be in ISO 8601 format")
});

// API Configuration Schema
export const BuildiumApiConfigSchema = z.object({
  baseUrl: z.string().url("Base URL must be a valid URL"),
  apiKey: z.string().min(1, "API key is required"),
  timeout: z.number().int().positive().default(30000),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().positive().default(1000)
});

// Export enhanced schema types
export type BuildiumPropertyCreateEnhancedInput = z.infer<typeof BuildiumPropertyCreateEnhancedSchema>
export type BuildiumPropertyUpdateEnhancedInput = z.infer<typeof BuildiumPropertyUpdateEnhancedSchema>
export type BuildiumUnitCreateEnhancedInput = z.infer<typeof BuildiumUnitCreateEnhancedSchema>
export type BuildiumOwnerCreateEnhancedInput = z.infer<typeof BuildiumOwnerCreateEnhancedSchema>
export type BuildiumVendorCreateEnhancedInput = z.infer<typeof BuildiumVendorCreateEnhancedSchema>
export type BuildiumTaskCreateEnhancedInput = z.infer<typeof BuildiumTaskCreateEnhancedSchema>
export type BuildiumBillCreateEnhancedInput = z.infer<typeof BuildiumBillCreateEnhancedSchema>
export type BuildiumBankAccountCreateEnhancedInput = z.infer<typeof BuildiumBankAccountCreateEnhancedSchema>
export type BuildiumLeaseCreateEnhancedInput = z.infer<typeof BuildiumLeaseCreateEnhancedSchema>
export type BuildiumWebhookEventInput = z.infer<typeof BuildiumWebhookEventSchema>
export type BuildiumWebhookPayloadInput = z.infer<typeof BuildiumWebhookPayloadSchema>
export type BuildiumSyncStatusInput = z.infer<typeof BuildiumSyncStatusSchema>
export type BuildiumApiConfigInput = z.infer<typeof BuildiumApiConfigSchema>

// Add enhanced schemas to the main export
export const BuildiumSchemasEnhanced = {
  PropertyCreateEnhanced: BuildiumPropertyCreateEnhancedSchema,
  PropertyUpdateEnhanced: BuildiumPropertyUpdateEnhancedSchema,
  UnitCreateEnhanced: BuildiumUnitCreateEnhancedSchema,
  OwnerCreateEnhanced: BuildiumOwnerCreateEnhancedSchema,
  VendorCreateEnhanced: BuildiumVendorCreateEnhancedSchema,
  TaskCreateEnhanced: BuildiumTaskCreateEnhancedSchema,
  BillCreateEnhanced: BuildiumBillCreateEnhancedSchema,
  BankAccountCreateEnhanced: BuildiumBankAccountCreateEnhancedSchema,
  LeaseCreateEnhanced: BuildiumLeaseCreateEnhancedSchema,
  WebhookEvent: BuildiumWebhookEventSchema,
  WebhookPayload: BuildiumWebhookPayloadSchema,
  SyncStatus: BuildiumSyncStatusSchema,
  ApiConfig: BuildiumApiConfigSchema
}
