// TypeScript interfaces for the Contacts table
// These match the database schema defined in the migration

// Database schema (snake_case) - Based on live database
export interface ContactDB {
  id: number;
  is_company: boolean;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  primary_email?: string;
  alt_email?: string;
  primary_phone?: string;
  alt_phone?: string;
  date_of_birth?: string;
  primary_address_line_1?: string;
  primary_address_line_2?: string;
  primary_address_line_3?: string;
  primary_city?: string;
  primary_state?: string;
  primary_postal_code?: string;
  primary_country?: Database["public"]["Enums"]["countries"];
  alt_address_line_1?: string;
  alt_address_line_2?: string;
  alt_address_line_3?: string;
  alt_city?: string;
  alt_state?: string;
  alt_postal_code?: string;
  alt_country?: Database["public"]["Enums"]["countries"];
  mailing_preference?: string;
  tax_payer_id?: string;
  tax_payer_type?: string;
  tax_payer_name?: string;
  tax_address_line_1?: string;
  tax_address_line_2?: string;
  tax_address_line_3?: string;
  tax_city?: string;
  tax_state?: string;
  tax_postal_code?: string;
  tax_country?: string;
  created_at: string;
  updated_at: string;
}

// Application interface (camelCase)
export interface Contact {
  id: number;
  isCompany: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  primaryEmail?: string;
  altEmail?: string;
  primaryPhone?: string;
  altPhone?: string;
  dateOfBirth?: string;
  primaryAddressLine1?: string;
  primaryAddressLine2?: string;
  primaryAddressLine3?: string;
  primaryCity?: string;
  primaryState?: string;
  primaryPostalCode?: string;
  primaryCountry?: string;
  altAddressLine1?: string;
  altAddressLine2?: string;
  altAddressLine3?: string;
  altCity?: string;
  altState?: string;
  altPostalCode?: string;
  altCountry?: string;
  mailingPreference?: string;
  taxPayerId?: string;
  taxPayerType?: string;
  taxPayerName?: string;
  taxAddressLine1?: string;
  taxAddressLine2?: string;
  taxAddressLine3?: string;
  taxCity?: string;
  taxState?: string;
  taxPostalCode?: string;
  taxCountry?: string;
  createdAt: string;
  updatedAt: string;
}

// Database to Application mapping
export function mapContactFromDB(dbContact: ContactDB): Contact {
  return {
    id: dbContact.id,
    isCompany: dbContact.is_company,
    firstName: dbContact.first_name,
    lastName: dbContact.last_name,
    companyName: dbContact.company_name,
    primaryEmail: dbContact.primary_email,
    altEmail: dbContact.alt_email,
    primaryPhone: dbContact.primary_phone,
    altPhone: dbContact.alt_phone,
    dateOfBirth: dbContact.date_of_birth,
    primaryAddressLine1: dbContact.primary_address_line_1,
    primaryAddressLine2: dbContact.primary_address_line_2,
    primaryAddressLine3: dbContact.primary_address_line_3,
    primaryCity: dbContact.primary_city,
    primaryState: dbContact.primary_state,
    primaryPostalCode: dbContact.primary_postal_code,
    primaryCountry: dbContact.primary_country,
    altAddressLine1: dbContact.alt_address_line_1,
    altAddressLine2: dbContact.alt_address_line_2,
    altAddressLine3: dbContact.alt_address_line_3,
    altCity: dbContact.alt_city,
    altState: dbContact.alt_state,
    altPostalCode: dbContact.alt_postal_code,
    altCountry: dbContact.alt_country,
    mailingPreference: dbContact.mailing_preference,
    taxPayerId: dbContact.tax_payer_id,
    taxPayerType: dbContact.tax_payer_type,
    taxPayerName: dbContact.tax_payer_name,
    taxAddressLine1: dbContact.tax_address_line_1,
    taxAddressLine2: dbContact.tax_address_line_2,
    taxAddressLine3: dbContact.tax_address_line_3,
    taxCity: dbContact.tax_city,
    taxState: dbContact.tax_state,
    taxPostalCode: dbContact.tax_postal_code,
    taxCountry: dbContact.tax_country,
    createdAt: dbContact.created_at,
    updatedAt: dbContact.updated_at,
  };
}

// Application to Database mapping
export function mapContactToDB(contact: Partial<Contact>): Partial<ContactDB> {
  const dbContact: Partial<ContactDB> = {};
  
  if (contact.isCompany !== undefined) dbContact.is_company = contact.isCompany;
  if (contact.firstName !== undefined) dbContact.first_name = contact.firstName;
  if (contact.lastName !== undefined) dbContact.last_name = contact.lastName;
  if (contact.companyName !== undefined) dbContact.company_name = contact.companyName;
  if (contact.primaryEmail !== undefined) dbContact.primary_email = contact.primaryEmail;
  if (contact.altEmail !== undefined) dbContact.alt_email = contact.altEmail;
  if (contact.primaryPhone !== undefined) dbContact.primary_phone = contact.primaryPhone;
  if (contact.altPhone !== undefined) dbContact.alt_phone = contact.altPhone;
  if (contact.dateOfBirth !== undefined) dbContact.date_of_birth = contact.dateOfBirth;
  if (contact.primaryAddressLine1 !== undefined) dbContact.primary_address_line_1 = contact.primaryAddressLine1;
  if (contact.primaryAddressLine2 !== undefined) dbContact.primary_address_line_2 = contact.primaryAddressLine2;
  if (contact.primaryAddressLine3 !== undefined) dbContact.primary_address_line_3 = contact.primaryAddressLine3;
  if (contact.primaryCity !== undefined) dbContact.primary_city = contact.primaryCity;
  if (contact.primaryState !== undefined) dbContact.primary_state = contact.primaryState;
  if (contact.primaryPostalCode !== undefined) dbContact.primary_postal_code = contact.primaryPostalCode;
  if (contact.primaryCountry !== undefined) dbContact.primary_country = contact.primaryCountry;
  if (contact.altAddressLine1 !== undefined) dbContact.alt_address_line_1 = contact.altAddressLine1;
  if (contact.altAddressLine2 !== undefined) dbContact.alt_address_line_2 = contact.altAddressLine2;
  if (contact.altAddressLine3 !== undefined) dbContact.alt_address_line_3 = contact.altAddressLine3;
  if (contact.altCity !== undefined) dbContact.alt_city = contact.altCity;
  if (contact.altState !== undefined) dbContact.alt_state = contact.altState;
  if (contact.altPostalCode !== undefined) dbContact.alt_postal_code = contact.altPostalCode;
  if (contact.altCountry !== undefined) dbContact.alt_country = contact.altCountry;
  if (contact.mailingPreference !== undefined) dbContact.mailing_preference = contact.mailingPreference;
  if (contact.taxPayerId !== undefined) dbContact.tax_payer_id = contact.taxPayerId;
  if (contact.taxPayerType !== undefined) dbContact.tax_payer_type = contact.taxPayerType;
  if (contact.taxPayerName !== undefined) dbContact.tax_payer_name = contact.taxPayerName;
  if (contact.taxAddressLine1 !== undefined) dbContact.tax_address_line_1 = contact.taxAddressLine1;
  if (contact.taxAddressLine2 !== undefined) dbContact.tax_address_line_2 = contact.taxAddressLine2;
  if (contact.taxAddressLine3 !== undefined) dbContact.tax_address_line_3 = contact.taxAddressLine3;
  if (contact.taxCity !== undefined) dbContact.tax_city = contact.taxCity;
  if (contact.taxState !== undefined) dbContact.tax_state = contact.taxState;
  if (contact.taxPostalCode !== undefined) dbContact.tax_postal_code = contact.taxPostalCode;
  if (contact.taxCountry !== undefined) dbContact.tax_country = contact.taxCountry;
  
  return dbContact;
}

export interface CreateContactRequest {
  isCompany: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  primaryEmail?: string;
  altEmail?: string;
  primaryPhone?: string;
  altPhone?: string;
  dateOfBirth?: string;
  primaryAddressLine1?: string;
  primaryAddressLine2?: string;
  primaryAddressLine3?: string;
  primaryCity?: string;
  primaryState?: string;
  primaryPostalCode?: string;
  primaryCountry?: string;
  altAddressLine1?: string;
  altAddressLine2?: string;
  altAddressLine3?: string;
  altCity?: string;
  altState?: string;
  altPostalCode?: string;
  altCountry?: string;
  mailingPreference?: string;
  taxPayerId?: string;
  taxPayerType?: string;
  taxPayerName?: string;
  taxAddressLine1?: string;
  taxAddressLine2?: string;
  taxAddressLine3?: string;
  taxCity?: string;
  taxState?: string;
  taxPostalCode?: string;
  taxCountry?: string;
}

export interface UpdateContactRequest extends Partial<CreateContactRequest> {
  id: number;
}

// Utility types for form handling
export interface ContactFormData {
  isCompany: boolean;
  firstName: string;
  lastName: string;
  companyName: string;
  primaryEmail: string;
  altEmail: string;
  primaryPhone: string;
  altPhone: string;
  dateOfBirth: string;
  primaryAddressLine1: string;
  primaryAddressLine2: string;
  primaryAddressLine3: string;
  primaryCity: string;
  primaryState: string;
  primaryPostalCode: string;
  primaryCountry: string;
  altAddressLine1: string;
  altAddressLine2: string;
  altAddressLine3: string;
  altCity: string;
  altState: string;
  altPostalCode: string;
  altCountry: string;
  mailingPreference: string;
  taxPayerId: string;
  taxPayerType: string;
  taxPayerName: string;
  taxAddressLine1: string;
  taxAddressLine2: string;
  taxAddressLine3: string;
  taxCity: string;
  taxState: string;
  taxPostalCode: string;
  taxCountry: string;
}

// Constants for form validation
export const CONTACT_CONSTRAINTS = {
  firstName: {
    maxLength: 100
  },
  lastName: {
    maxLength: 100
  },
  companyName: {
    maxLength: 200
  },
  primaryEmail: {
    maxLength: 255
  },
  altEmail: {
    maxLength: 255
  },
  primaryPhone: {
    maxLength: 20
  },
  altPhone: {
    maxLength: 20
  }
} as const;
import type { Database } from './database'
