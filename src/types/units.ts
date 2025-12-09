import type { Database as DatabaseSchema } from '@/types/database';

// Enum types for unit bedrooms and bathrooms (matching database enum names)
export type BedroomEnum = 'Studio' | '1' | '2' | '3' | '4' | '5+' | '6' | '7' | '8' | '9+';
export type BathroomEnum = '1' | '1.5' | '2' | '2.5' | '3' | '3.5' | '4+' | '4.5' | '5' | '5+';

// Service-related enums
export type ServicePlan = 'Full' | 'Basic' | 'A-la-carte' | 'Custom';
export type FeeFrequency = 'Monthly' | 'Annually';
export type FeeType = 'Percentage' | 'Flat Rate';

// Array constants for use in dropdowns
export const BEDROOM_OPTIONS: BedroomEnum[] = [
  'Studio',
  '1',
  '2',
  '3',
  '4',
  '5+',
  '6',
  '7',
  '8',
  '9+',
];
export const BATHROOM_OPTIONS: BathroomEnum[] = [
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '3.5',
  '4+',
  '4.5',
  '5',
  '5+',
];
export const SERVICE_PLAN_OPTIONS: ServicePlan[] = ['Full', 'Basic', 'A-la-carte', 'Custom'];
export const FEE_FREQUENCY_OPTIONS: FeeFrequency[] = ['Monthly', 'Annually'];
export const FEE_TYPE_OPTIONS: FeeType[] = ['Percentage', 'Flat Rate'];

export type CountryEnum = DatabaseSchema['public']['Enums']['countries'];
export type UnitDB = DatabaseSchema['public']['Tables']['units']['Row'];
export type UnitUpdateDB = DatabaseSchema['public']['Tables']['units']['Update'];

// Application interface (camelCase) - Updated to match live database
export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  unitSize?: number | null;
  marketRent?: number | null;
  addressLine1: string;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode: string;
  country: CountryEnum | null;
  unitBedrooms?: BedroomEnum | null;
  unitBathrooms?: BathroomEnum | null;
  description?: string | null;
  buildiumUnitId?: number | null;
  buildiumPropertyId?: number | null;
  serviceStart?: string | null;
  serviceEnd?: string | null;
  servicePlan?: ServicePlan | null;
  feeType?: FeeType | null;
  feePercent?: number | null;
  feeDollarAmount?: number | null;
  feeFrequency?: FeeFrequency | null;
  activeServices?: string | null;
  feeNotes?: string | null;
  billPayList?: string | null;
  billPayNotes?: string | null;
  unitType?: string | null;
  isActive?: boolean | null;
  buildiumCreatedAt?: string | null;
  buildiumUpdatedAt?: string | null;
  buildingName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Database to Application mapping
export function mapUnitFromDB(dbUnit: UnitDB): Unit {
  return {
    id: dbUnit.id,
    propertyId: dbUnit.property_id,
    unitNumber: dbUnit.unit_number,
    unitSize: dbUnit.unit_size,
    marketRent: dbUnit.market_rent,
    addressLine1: dbUnit.address_line1,
    addressLine2: dbUnit.address_line2,
    addressLine3: dbUnit.address_line3,
    city: dbUnit.city,
    state: dbUnit.state,
    postalCode: dbUnit.postal_code,
    country: dbUnit.country ?? null,
    unitBedrooms: dbUnit.unit_bedrooms,
    unitBathrooms: dbUnit.unit_bathrooms,
    description: dbUnit.description,
    buildiumUnitId: dbUnit.buildium_unit_id,
    buildiumPropertyId: dbUnit.buildium_property_id,
    serviceStart: dbUnit.service_start,
    serviceEnd: dbUnit.service_end,
    servicePlan: dbUnit.service_plan,
    feeType: dbUnit.fee_type,
    feePercent: dbUnit.fee_percent,
    feeDollarAmount: dbUnit.fee_dollar_amount,
    feeFrequency: dbUnit.fee_frequency,
    activeServices: dbUnit.active_services,
    feeNotes: dbUnit.fee_notes,
    billPayList: dbUnit.bill_pay_list,
    billPayNotes: dbUnit.bill_pay_notes,
    unitType: dbUnit.unit_type,
    isActive: dbUnit.is_active,
    buildiumCreatedAt: dbUnit.buildium_created_at,
    buildiumUpdatedAt: dbUnit.buildium_updated_at,
    buildingName: dbUnit.building_name,
    createdAt: dbUnit.created_at,
    updatedAt: dbUnit.updated_at,
  };
}

// Application to Database mapping
export function mapUnitToDB(unit: Partial<Unit>): UnitUpdateDB {
  const dbUnit: UnitUpdateDB = {};

  if (unit.propertyId !== undefined) dbUnit.property_id = unit.propertyId;
  if (unit.unitNumber !== undefined) dbUnit.unit_number = unit.unitNumber;
  if (unit.unitSize !== undefined) dbUnit.unit_size = unit.unitSize;
  if (unit.marketRent !== undefined) dbUnit.market_rent = unit.marketRent;
  if (unit.addressLine1 !== undefined) dbUnit.address_line1 = unit.addressLine1;
  if (unit.addressLine2 !== undefined) dbUnit.address_line2 = unit.addressLine2;
  if (unit.addressLine3 !== undefined) dbUnit.address_line3 = unit.addressLine3;
  if (unit.city !== undefined) dbUnit.city = unit.city;
  if (unit.state !== undefined) dbUnit.state = unit.state;
  if (unit.postalCode !== undefined) dbUnit.postal_code = unit.postalCode;
  if (unit.country !== undefined && unit.country !== null) {
    dbUnit.country = unit.country;
  }
  if (unit.unitBedrooms !== undefined) dbUnit.unit_bedrooms = unit.unitBedrooms ?? null;
  if (unit.unitBathrooms !== undefined) dbUnit.unit_bathrooms = unit.unitBathrooms ?? null;
  if (unit.description !== undefined) dbUnit.description = unit.description ?? null;
  if (unit.buildiumUnitId !== undefined) dbUnit.buildium_unit_id = unit.buildiumUnitId ?? null;
  if (unit.buildiumPropertyId !== undefined)
    dbUnit.buildium_property_id = unit.buildiumPropertyId ?? null;
  if (unit.serviceStart !== undefined) dbUnit.service_start = unit.serviceStart ?? null;
  if (unit.serviceEnd !== undefined) dbUnit.service_end = unit.serviceEnd ?? null;
  if (unit.servicePlan !== undefined) dbUnit.service_plan = unit.servicePlan ?? null;
  if (unit.feeType !== undefined) dbUnit.fee_type = unit.feeType ?? null;
  if (unit.feePercent !== undefined) dbUnit.fee_percent = unit.feePercent ?? null;
  if (unit.feeDollarAmount !== undefined) dbUnit.fee_dollar_amount = unit.feeDollarAmount ?? null;
  if (unit.feeFrequency !== undefined) dbUnit.fee_frequency = unit.feeFrequency ?? null;
  if (unit.activeServices !== undefined) dbUnit.active_services = unit.activeServices ?? null;
  if (unit.feeNotes !== undefined) dbUnit.fee_notes = unit.feeNotes ?? null;
  if (unit.billPayList !== undefined) dbUnit.bill_pay_list = unit.billPayList ?? null;
  if (unit.billPayNotes !== undefined) dbUnit.bill_pay_notes = unit.billPayNotes ?? null;
  if (unit.unitType !== undefined) dbUnit.unit_type = unit.unitType ?? null;

  if (unit.isActive !== undefined) dbUnit.is_active = unit.isActive ?? null;
  if (unit.buildiumCreatedAt !== undefined)
    dbUnit.buildium_created_at = unit.buildiumCreatedAt ?? null;
  if (unit.buildiumUpdatedAt !== undefined)
    dbUnit.buildium_updated_at = unit.buildiumUpdatedAt ?? null;
  if (unit.buildingName !== undefined) dbUnit.building_name = unit.buildingName ?? null;

  return dbUnit;
}
