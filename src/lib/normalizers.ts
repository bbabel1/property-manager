import type { Database as DatabaseSchema } from '@/types/database'

type CountriesEnum = DatabaseSchema['public']['Enums']['countries']
type EtfAccountTypeEnum = DatabaseSchema['public']['Enums']['etf_account_type_enum']
type PropertyTypeEnum = DatabaseSchema['public']['Enums']['property_type_enum']
type PropertyStatusEnum = DatabaseSchema['public']['Enums']['property_status']
type AssignmentLevelEnum = DatabaseSchema['public']['Enums']['assignment_level_enum']
type AssignmentLevel = DatabaseSchema['public']['Enums']['assignment_level']
type FeeTypeEnum = DatabaseSchema['public']['Enums']['fee_type_enum']
type BillingFrequencyEnum = DatabaseSchema['public']['Enums']['billing_frequency_enum']
type FeeFrequencyEnum = DatabaseSchema['public']['Enums']['FeeFrequency']
type ServicePlanEnum = DatabaseSchema['public']['Enums']['service_plan_enum']
// type ManagementServiceEnum = DatabaseSchema['public']['Enums']['management_services_enum'] // Enum doesn't exist in DB
type ManagementServiceEnum = string
type BedroomEnum = DatabaseSchema['public']['Enums']['bedroom_enum']
type BathroomEnum = DatabaseSchema['public']['Enums']['bathroom_enum']

export type CountryEnum = CountriesEnum

const COUNTRY_SYNONYMS: Record<string, CountryEnum> = {
  usa: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  us: 'United States',
}

const DEFAULT_COUNTRY: CountryEnum = 'United States' as CountryEnum

export function normalizeCountry(value: string | null | undefined): CountryEnum | null {
  if (!value) return null
  const cleaned = value.trim()
  if (!cleaned) return null
  const key = cleaned.toLowerCase()
  return COUNTRY_SYNONYMS[key] ?? (cleaned as CountryEnum)
}

export function normalizeCountryWithDefault(value: string | null | undefined): CountryEnum {
  return normalizeCountry(value) ?? DEFAULT_COUNTRY
}

export function normalizeEtfAccountType(value: string | null | undefined): EtfAccountTypeEnum | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'checking') return 'Checking'
  if (normalized === 'saving' || normalized === 'savings') return 'Saving'
  return (value as EtfAccountTypeEnum) ?? null
}

function normalizeEnumValue<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  aliases: Record<string, T> = {}
): T | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (aliases[key]) return aliases[key]
  for (const option of allowed) {
    const optionKey = option.toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (optionKey === key) return option
  }
  return null
}

const PROPERTY_TYPE_VALUES: PropertyTypeEnum[] = ['Condo', 'Co-op', 'Condop', 'Rental Building', 'Townhouse', 'Mult-Family']
const PROPERTY_TYPE_ALIASES: Record<string, PropertyTypeEnum> = {
  rentalbuilding: 'Rental Building',
  rental: 'Rental Building',
  townhouse: 'Townhouse',
  townhome: 'Townhouse',
  condo: 'Condo',
  coop: 'Co-op',
  condop: 'Condop',
  multifamily: 'Mult-Family',
  multifamilyhome: 'Mult-Family',
  'mult-family': 'Mult-Family',
}

const PROPERTY_STATUS_VALUES: PropertyStatusEnum[] = ['Active', 'Inactive']

const ASSIGNMENT_LEVEL_VALUES: AssignmentLevelEnum[] = ['Building', 'Unit']
const ASSIGNMENT_LEVEL_ALIASES: Record<string, AssignmentLevelEnum> = {
  property: 'Building',
  building: 'Building',
  portfolio: 'Building',
  unit: 'Unit',
}

const ASSIGNMENT_SCOPE_VALUES: AssignmentLevel[] = ['Property Level', 'Unit Level']
const ASSIGNMENT_SCOPE_ALIASES: Record<string, AssignmentLevel> = {
  propertylevel: 'Property Level',
  property: 'Property Level',
  building: 'Property Level',
  buildinglevel: 'Property Level',
  unitlevel: 'Unit Level',
  unit: 'Unit Level',
}

const FEE_TYPE_VALUES: FeeTypeEnum[] = ['Percentage', 'Flat Rate']
const FEE_TYPE_ALIASES: Record<string, FeeTypeEnum> = {
  percent: 'Percentage',
  percentage: 'Percentage',
  flatrate: 'Flat Rate',
  flat: 'Flat Rate',
}

const BILLING_FREQUENCY_VALUES: BillingFrequencyEnum[] = ['Annual', 'Monthly']
const BILLING_FREQUENCY_ALIASES: Record<string, BillingFrequencyEnum> = {
  annually: 'Annual',
  annual: 'Annual',
  yearly: 'Annual',
  monthly: 'Monthly',
  month: 'Monthly',
}

const FEE_FREQUENCY_VALUES: FeeFrequencyEnum[] = ['Monthly', 'Annually']
const FEE_FREQUENCY_ALIASES: Record<string, FeeFrequencyEnum> = {
  monthly: 'Monthly',
  month: 'Monthly',
  annually: 'Annually',
  annual: 'Annually',
  yearly: 'Annually',
}

const SERVICE_PLAN_VALUES: ServicePlanEnum[] = ['Full', 'Basic', 'A-la-carte']
const SERVICE_PLAN_ALIASES: Record<string, ServicePlanEnum> = {
  full: 'Full',
  basic: 'Basic',
  'a-lacarte': 'A-la-carte',
  alacarte: 'A-la-carte',
  'a la carte': 'A-la-carte',
  alaCarte: 'A-la-carte',
}

const MANAGEMENT_SERVICE_VALUES: ManagementServiceEnum[] = [
  'Rent Collection',
  'Maintenance',
  'Turnovers',
  'Compliance',
  'Bill Pay',
  'Condition Reports',
  'Renewals',
]

const BEDROOM_VALUES: BedroomEnum[] = ['Studio', '1', '2', '3', '4', '5+', '6', '7', '8', '9+']
const BEDROOM_ALIASES: Record<string, BedroomEnum> = {
  studio: 'Studio',
  '0': 'Studio',
  '5': '5+',
  '5plus': '5+',
  '5+': '5+',
  '9plus': '9+',
}

const BATHROOM_VALUES: BathroomEnum[] = ['1', '1.5', '2', '2.5', '3', '3.5', '4+', '4.5', '5', '5+']
const BATHROOM_ALIASES: Record<string, BathroomEnum> = {
  '4': '4+',
  '4plus': '4+',
  '4+': '4+',
  '5plus': '5+',
  '5+': '5+',
}

export function normalizePropertyType(value: string | null | undefined): PropertyTypeEnum | null {
  return normalizeEnumValue(value, PROPERTY_TYPE_VALUES, PROPERTY_TYPE_ALIASES)
}

export function normalizePropertyStatus(value: string | null | undefined, fallback: PropertyStatusEnum = 'Active'): PropertyStatusEnum {
  return normalizeEnumValue(value, PROPERTY_STATUS_VALUES) ?? fallback
}

export function normalizeAssignmentLevelEnum(value: string | null | undefined): AssignmentLevelEnum | null {
  return normalizeEnumValue(value, ASSIGNMENT_LEVEL_VALUES, ASSIGNMENT_LEVEL_ALIASES)
}

export function normalizeAssignmentLevel(value: string | null | undefined): AssignmentLevel | null {
  return normalizeEnumValue(value, ASSIGNMENT_SCOPE_VALUES, ASSIGNMENT_SCOPE_ALIASES)
}

export function normalizeFeeType(value: string | null | undefined): FeeTypeEnum | null {
  return normalizeEnumValue(value, FEE_TYPE_VALUES, FEE_TYPE_ALIASES)
}

export function normalizeBillingFrequency(value: string | null | undefined): BillingFrequencyEnum | null {
  return normalizeEnumValue(value, BILLING_FREQUENCY_VALUES, BILLING_FREQUENCY_ALIASES)
}

export function normalizeServicePlan(value: string | null | undefined): ServicePlanEnum | null {
  return normalizeEnumValue(value, SERVICE_PLAN_VALUES, SERVICE_PLAN_ALIASES)
}

export function normalizeFeeFrequency(value: string | null | undefined): FeeFrequencyEnum | null {
  return normalizeEnumValue(value, FEE_FREQUENCY_VALUES, FEE_FREQUENCY_ALIASES)
}

export function normalizeManagementServicesList(value: unknown): ManagementServiceEnum[] | null {
  if (typeof value === 'string') {
    const parts = value.split(',').map(part => part.trim()).filter(Boolean)
    return normalizeManagementServicesList(parts)
  }
  if (!Array.isArray(value)) return null
  const normalized: ManagementServiceEnum[] = []
  for (const item of value) {
    const mapped = normalizeEnumValue(String(item), MANAGEMENT_SERVICE_VALUES)
    if (mapped && !normalized.includes(mapped)) normalized.push(mapped)
  }
  return normalized.length ? normalized : null
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function toNumberOrDefault(value: unknown, defaultValue = 0): number {
  const num = toNumberOrNull(value)
  return num === null ? defaultValue : num
}

export function normalizeUnitBedrooms(value: unknown): BedroomEnum | null {
  if (value === null || value === undefined) return null
  const str = String(value)
  return normalizeEnumValue(str, BEDROOM_VALUES, BEDROOM_ALIASES)
}

export function normalizeUnitBathrooms(value: unknown): BathroomEnum | null {
  if (value === null || value === undefined) return null
  const str = String(value)
  return normalizeEnumValue(str, BATHROOM_VALUES, BATHROOM_ALIASES)
}
