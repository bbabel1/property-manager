import { z } from 'zod'
import type {
  BuildiumGLAccount,
  BuildiumProperty,
  BuildiumUnit,
  BuildiumVendor,
  BuildiumWorkOrder,
} from '@/types/buildium'

export type BuildiumGLAccountExtended = BuildiumGLAccount & { IsSecurityDepositLiability?: boolean | null }

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] }

const parseIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const path = issue.path.join('.') || 'root'
    return `${path}: ${issue.message}`
  })

const coerceDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const requiredNumber = z.preprocess(
  (value) => (typeof value === 'number' ? value : Number(value)),
  z.number().finite(),
)

const optionalNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}, z.number().finite().nullable())

const requiredString = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }
  if (typeof value === 'number') return String(value)
  return undefined
}, z.string().min(1))

const optionalString = z.preprocess((value) => {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length ? s : null
}, z.string().nullable())

const optionalBoolean = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 't', 'yes', 'y', '1'].includes(normalized)) return true
    if (['false', 'f', 'no', 'n', '0'].includes(normalized)) return false
  }
  return undefined
}, z.boolean().optional())

const requiredDateString = z
  .preprocess((value) => coerceDate(value) ?? new Date(0).toISOString(), z.string())
  .transform((v) => v)

const optionalDateString = z.preprocess((value) => coerceDate(value), z.string().nullable())

const addressSchema = z.object({
  AddressLine1: requiredString,
  AddressLine2: optionalString,
  AddressLine3: optionalString,
  City: requiredString,
  State: requiredString,
  PostalCode: requiredString,
  Country: requiredString,
})

const buildiumUnitSchema = z.object({
  Id: requiredNumber,
  PropertyId: requiredNumber,
  BuildingName: optionalString,
  UnitNumber: requiredString,
  Description: optionalString,
  MarketRent: optionalNumber,
  Address: addressSchema.optional(),
  UnitBedrooms: optionalString,
  UnitBathrooms: optionalString,
  UnitSize: optionalNumber,
  IsUnitListed: optionalBoolean,
  IsUnitOccupied: optionalBoolean,
})

const buildiumPropertySchema = z.object({
  Id: requiredNumber,
  Name: requiredString,
  StructureDescription: optionalString,
  NumberUnits: optionalNumber,
  IsActive: optionalBoolean.default(true),
  OperatingBankAccountId: optionalNumber,
  Reserve: optionalNumber,
  Address: addressSchema,
  YearBuilt: optionalNumber,
  RentalType: optionalString.transform((v) => v ?? 'Rental'),
  RentalSubType: optionalString.transform((v) => v ?? ''),
  RentalManager: optionalNumber,
  CreatedDate: optionalDateString.transform((v) => v ?? new Date(0).toISOString()),
  ModifiedDate: optionalDateString.transform((v) => v ?? new Date(0).toISOString()),
})

const buildiumSubAccountSchema = z
  .union([
    optionalNumber.transform((value) => (value != null ? { Id: value } : null)),
    z
      .object({
        Id: optionalNumber,
        AccountNumber: optionalString,
        Name: optionalString,
        Href: optionalString,
      })
      .partial()
      .transform((value) =>
        value.Id != null
          ? {
              Id: value.Id,
              AccountNumber: value.AccountNumber ?? undefined,
              Name: value.Name ?? undefined,
              Href: value.Href ?? undefined,
            }
          : null,
      ),
  ])
  .transform((v) => v ?? null)

const buildiumGLAccountExtendedSchema = z.object({
  Id: requiredNumber,
  AccountNumber: optionalString,
  Name: requiredString,
  Description: optionalString,
  Type: optionalString.transform((v) => v ?? 'Other'),
  SubType: optionalString,
  IsDefaultGLAccount: optionalBoolean,
  DefaultAccountName: optionalString,
  IsContraAccount: optionalBoolean,
  IsBankAccount: optionalBoolean,
  CashFlowClassification: optionalString,
  ExcludeFromCashBalances: optionalBoolean,
  IsActive: optionalBoolean,
  ParentGLAccountId: optionalNumber,
  IsCreditCardAccount: optionalBoolean,
  SubAccounts: z
    .array(buildiumSubAccountSchema)
    .optional()
    .transform((list) =>
      (list || []).filter(
        (item): item is { Id: number; AccountNumber?: string | null; Name?: string | null; Href?: string | null } =>
          Boolean(item?.Id && Number.isFinite(item.Id)),
      ),
    ),
  IsSecurityDepositLiability: optionalBoolean.transform((v) => v ?? false),
})

const buildiumVendorSchema = z.object({
  Id: requiredNumber,
  Name: requiredString,
  IsCompany: optionalBoolean,
  IsActive: optionalBoolean.transform((v) => v ?? true),
  FirstName: optionalString,
  LastName: optionalString,
  PrimaryEmail: optionalString,
  AlternateEmail: optionalString,
  CompanyName: optionalString,
  PhoneNumber: optionalString,
  PhoneNumbers: z.any().optional(),
  Website: optionalString,
  Category: z
    .object({
      Id: optionalNumber,
      Name: optionalString,
    })
    .partial()
    .optional(),
  CategoryId: optionalNumber,
  ContactName: optionalString,
  Email: optionalString,
  Address: addressSchema,
  VendorInsurance: z
    .object({
      Provider: optionalString,
      PolicyNumber: optionalString,
      ExpirationDate: optionalDateString,
    })
    .partial()
    .optional(),
  TaxInformation: z
    .object({
      TaxPayerIdType: optionalString,
      TaxPayerId: optionalString,
      TaxPayerName1: optionalString,
      TaxPayerName2: optionalString,
      IncludeIn1099: optionalBoolean,
      Address: addressSchema.partial().optional(),
    })
    .partial()
    .optional(),
  AccountNumber: optionalString,
  ExpenseGLAccountId: optionalNumber,
  Comments: optionalString,
  TaxId: optionalString,
  Notes: optionalString,
  CreatedDate: requiredDateString,
  ModifiedDate: requiredDateString,
})

const buildiumWorkOrderSchema = z.object({
  Id: requiredNumber,
  Category: z
    .object({
      Id: optionalNumber,
      Name: optionalString,
      SubCategory: z.object({ Id: optionalNumber, Name: optionalString }).partial().optional(),
    })
    .partial()
    .optional(),
  Title: optionalString,
  Subject: optionalString,
  Description: optionalString,
  Property: z.object({
    Id: requiredNumber,
    Type: optionalString.transform((v) => v ?? 'Rental'),
    Href: optionalString,
  }),
  UnitId: optionalNumber,
  RequestedByUserEntity: z
    .object({
      Type: optionalString,
      Id: optionalNumber,
      FirstName: optionalString,
      LastName: optionalString,
      IsCompany: optionalBoolean,
      Href: optionalString,
    })
    .partial()
    .optional(),
  AssignedToUserId: optionalNumber,
  WorkOrderStatus: optionalString,
  Status: optionalString,
  Priority: optionalString,
  DueDate: optionalDateString,
  WorkOrderDueDate: optionalDateString,
  CreatedDateTime: optionalDateString,
  LastUpdatedDateTime: optionalDateString,
  VendorId: optionalNumber,
  EstimatedCost: optionalNumber,
  ActualCost: optionalNumber,
  ScheduledDate: optionalDateString,
  CompletedDate: optionalDateString,
  VendorNotes: optionalString,
  WorkDetails: optionalString,
  Task: z
    .object({
      UnitId: optionalNumber,
      Property: z.object({ Id: optionalNumber }).partial().optional(),
    })
    .partial()
    .optional(),
})

export function parseBuildiumUnitPayload(value: unknown): ParseResult<BuildiumUnit> {
  const parsed = buildiumUnitSchema.safeParse(value)
  if (!parsed.success) return { ok: false, errors: parseIssues(parsed.error) }
  return { ok: true, data: parsed.data as BuildiumUnit }
}

export function parseBuildiumPropertyPayload(value: unknown): ParseResult<BuildiumProperty> {
  const parsed = buildiumPropertySchema.safeParse(value)
  if (!parsed.success) return { ok: false, errors: parseIssues(parsed.error) }
  return { ok: true, data: parsed.data as BuildiumProperty }
}

export function parseBuildiumGLAccountPayload(
  value: unknown,
): ParseResult<BuildiumGLAccountExtended> {
  const parsed = buildiumGLAccountExtendedSchema.safeParse(value)
  if (!parsed.success) return { ok: false, errors: parseIssues(parsed.error) }
  return { ok: true, data: parsed.data as BuildiumGLAccountExtended }
}

export function parseBuildiumVendorPayload(value: unknown): ParseResult<BuildiumVendor> {
  const parsed = buildiumVendorSchema.safeParse(value)
  if (!parsed.success) return { ok: false, errors: parseIssues(parsed.error) }
  return { ok: true, data: parsed.data as BuildiumVendor }
}

export function parseBuildiumWorkOrderPayload(value: unknown): ParseResult<BuildiumWorkOrder> {
  const parsed = buildiumWorkOrderSchema.safeParse(value)
  if (!parsed.success) return { ok: false, errors: parseIssues(parsed.error) }
  return { ok: true, data: parsed.data as BuildiumWorkOrder }
}
