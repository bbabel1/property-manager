// Enum types for unit bedrooms and bathrooms (matching database enum names)
export type BedroomEnum = 'Studio' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9+';
export type BathroomEnum = '1' | '1.5' | '2' | '2.5' | '3' | '3.5' | '4' | '4.5' | '5' | '5+';

// Service-related enums
export type ServicePlan = 'Full' | 'Basic' | 'A-la-carte';
export type FeeFrequency = 'Monthly' | 'Annually';
export type FeeType = 'Percentage' | 'Flat Rate';

// Array constants for use in dropdowns
export const BEDROOM_OPTIONS: BedroomEnum[] = ['Studio', '1', '2', '3', '4', '5', '6', '7', '8', '9+'];
export const BATHROOM_OPTIONS: BathroomEnum[] = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5+'];
export const SERVICE_PLAN_OPTIONS: ServicePlan[] = ['Full', 'Basic', 'A-la-carte'];
export const FEE_FREQUENCY_OPTIONS: FeeFrequency[] = ['Monthly', 'Annually'];
export const FEE_TYPE_OPTIONS: FeeType[] = ['Percentage', 'Flat Rate'];

// Database schema (snake_case) - Updated to match live database
export interface UnitDB {
  id: string;
  property_id: string;
  unit_number: string;
  unit_size?: number;
  market_rent?: number;
  address_line1: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  postal_code: string;
  country: Database["public"]["Enums"]["countries"];
  unit_bedrooms?: BedroomEnum;
  unit_bathrooms?: BathroomEnum;
  description?: string;
  buildium_unit_id?: number;
  buildium_property_id?: number;
  service_start?: string;
  service_end?: string;
  service_plan?: ServicePlan;
  fee_type?: FeeType;
  fee_percent?: number;
  management_fee?: number;
  fee_frequency?: FeeFrequency;
  active_services?: string;
  fee_notes?: string;
  unit_type?: string;
  is_active?: boolean;
  buildium_created_at?: string;
  buildium_updated_at?: string;
  building_name?: string;
  created_at: string;
  updated_at: string;
}

// Application interface (camelCase) - Updated to match live database
export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  unitSize?: number;
  marketRent?: number;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  state?: string;
  postalCode: string;
  country: string;
  unitBedrooms?: BedroomEnum;
  unitBathrooms?: BathroomEnum;
  description?: string;
  buildiumUnitId?: number;
  buildiumPropertyId?: number;
  serviceStart?: string;
  serviceEnd?: string;
  servicePlan?: ServicePlan;
  feeType?: FeeType;
  feePercent?: number;
  managementFee?: number;
  feeFrequency?: FeeFrequency;
  activeServices?: string;
  feeNotes?: string;
  unitType?: string;
  isActive?: boolean;
  buildiumCreatedAt?: string;
  buildiumUpdatedAt?: string;
  buildingName?: string;
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
    country: dbUnit.country,
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
    managementFee: dbUnit.management_fee,
    feeFrequency: dbUnit.fee_frequency,
    activeServices: dbUnit.active_services,
    feeNotes: dbUnit.fee_notes,
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
export function mapUnitToDB(unit: Partial<Unit>): Partial<UnitDB> {
  const dbUnit: Partial<UnitDB> = {};
  
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
  if (unit.country !== undefined) dbUnit.country = unit.country;
  if (unit.unitBedrooms !== undefined) dbUnit.unit_bedrooms = unit.unitBedrooms;
  if (unit.unitBathrooms !== undefined) dbUnit.unit_bathrooms = unit.unitBathrooms;
  if (unit.description !== undefined) dbUnit.description = unit.description;
  if (unit.buildiumUnitId !== undefined) dbUnit.buildium_unit_id = unit.buildiumUnitId;
  if (unit.buildiumPropertyId !== undefined) dbUnit.buildium_property_id = unit.buildiumPropertyId;
  if (unit.serviceStart !== undefined) dbUnit.service_start = unit.serviceStart;
  if (unit.serviceEnd !== undefined) dbUnit.service_end = unit.serviceEnd;
  if (unit.servicePlan !== undefined) dbUnit.service_plan = unit.servicePlan;
  if (unit.feeType !== undefined) dbUnit.fee_type = unit.feeType;
  if (unit.feePercent !== undefined) dbUnit.fee_percent = unit.feePercent;
  if (unit.managementFee !== undefined) dbUnit.management_fee = unit.managementFee;
  if (unit.feeFrequency !== undefined) dbUnit.fee_frequency = unit.feeFrequency;
  if (unit.activeServices !== undefined) dbUnit.active_services = unit.activeServices;
  if (unit.feeNotes !== undefined) dbUnit.fee_notes = unit.feeNotes;
  if (unit.unitType !== undefined) dbUnit.unit_type = unit.unitType;
  
  if (unit.isActive !== undefined) dbUnit.is_active = unit.isActive;
  if (unit.buildiumCreatedAt !== undefined) dbUnit.buildium_created_at = unit.buildiumCreatedAt;
  if (unit.buildiumUpdatedAt !== undefined) dbUnit.buildium_updated_at = unit.buildiumUpdatedAt;
  if (unit.buildingName !== undefined) dbUnit.building_name = unit.buildingName;
  
  return dbUnit;
}
import type { Database } from './database'
