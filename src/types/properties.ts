// TypeScript interfaces for the Properties table
// These match the database schema. Country type is sourced from Supabase-generated Database types.
import type { Database } from './database'
export type CountryEnum = Database['public']['Enums']['countries']

// Deprecated: rental_sub_type removed from DB and UI. Use property_type instead.

// Matches public.property_status enum
export type StatusEnum = 'Active' | 'Inactive' | 'Pending' | 'Sold' | 'Under Construction';

export interface Property {
  // Primary key
  id: string; // UUID
  
  // Basic property information
  name: string; // VARCHAR(127), NOT NULL
  structure_description?: string; // TEXT, NULL
  
  // Address information
  address_line1: string; // VARCHAR(100), NOT NULL
  address_line2?: string; // VARCHAR(100), NULL
  address_line3?: string; // VARCHAR(100), NULL
  city?: string; // VARCHAR(100), NULL
  state?: string; // VARCHAR(100), NULL
  postal_code: string; // VARCHAR(20), NOT NULL
  country: CountryEnum; // public.countries enum, NOT NULL
  
  // Integration and business fields
  buildium_property_id?: number; // INTEGER, NULL
  property_type?: 'Condo' | 'Co-op' | 'Condop' | 'Mult-Family' | 'Townhouse' | null;
  rental_owner_ids?: number[]; // INTEGER[], NULL
  operating_bank_account_id: number; // INTEGER, NOT NULL
  reserve?: number; // NUMERIC(12,2), NULL
  year_built?: number; // INTEGER, NULL (1000-current year)
  
  // Timestamps
  created_at: string; // TIMESTAMP WITH TIME ZONE, NOT NULL
  updated_at: string; // TIMESTAMP WITH TIME ZONE, NOT NULL
}

export interface CreatePropertyRequest {
  name: string;
  structure_description?: string;
  address_line1: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  postal_code: string;
  country: CountryEnum;
  buildium_property_id?: number;
  property_type?: 'Condo' | 'Co-op' | 'Condop' | 'Mult-Family' | 'Townhouse' | null;
  rental_owner_ids?: number[];
  operating_bank_account_id: number;
  reserve?: number;
  year_built?: number;
}

export interface UpdatePropertyRequest extends Partial<CreatePropertyRequest> {
  id: string;
}

// Utility types for form handling
export interface PropertyFormData {
  name: string;
  structure_description: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  postal_code: string;
  country: CountryEnum;
  buildium_property_id: string; // Form field as string
  property_type?: 'Condo' | 'Co-op' | 'Condop' | 'Mult-Family' | 'Townhouse' | null;
  rental_owner_ids: string; // Form field as comma-separated string
  operating_bank_account_id: string; // Form field as string
  reserve: string; // Form field as string
  year_built: string; // Form field as string
}

// Constants for form validation
export const PROPERTY_CONSTRAINTS = {
  name: {
    maxLength: 127,
    required: true
  },
  address_line1: {
    maxLength: 100,
    required: true
  },
  address_line2: {
    maxLength: 100
  },
  address_line3: {
    maxLength: 100
  },
  city: {
    maxLength: 100
  },
  state: {
    maxLength: 100
  },
  postal_code: {
    maxLength: 20,
    required: true
  },
  year_built: {
    min: 1000,
    max: new Date().getFullYear()
  },
  reserve: {
    min: 0,
    precision: 2
  }
} as const;
