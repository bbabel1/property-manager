import type { Database as DatabaseSchema } from '@/types/database'

export type ContactDB = DatabaseSchema['public']['Tables']['contacts']['Row']
export type ContactUpdateDB = DatabaseSchema['public']['Tables']['contacts']['Update']
export type CountryEnum = DatabaseSchema['public']['Enums']['countries']

// Application interface (camelCase)
export interface Contact {
  id: number;
  isCompany: boolean;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  primaryEmail?: string | null;
  altEmail?: string | null;
  primaryPhone?: string | null;
  altPhone?: string | null;
  dateOfBirth?: string | null;
  primaryAddressLine1?: string | null;
  primaryAddressLine2?: string | null;
  primaryAddressLine3?: string | null;
  primaryCity?: string | null;
  primaryState?: string | null;
  primaryPostalCode?: string | null;
  primaryCountry?: CountryEnum | null;
  altAddressLine1?: string | null;
  altAddressLine2?: string | null;
  altAddressLine3?: string | null;
  altCity?: string | null;
  altState?: string | null;
  altPostalCode?: string | null;
  altCountry?: CountryEnum | null;
  mailingPreference?: string | null;
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
    createdAt: dbContact.created_at,
    updatedAt: dbContact.updated_at,
  };
}

// Application to Database mapping
export function mapContactToDB(contact: Partial<Contact>): ContactUpdateDB {
  const dbContact: ContactUpdateDB = {};
  
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
  if (contact.primaryCountry !== undefined) dbContact.primary_country = contact.primaryCountry ?? null;
  if (contact.altAddressLine1 !== undefined) dbContact.alt_address_line_1 = contact.altAddressLine1;
  if (contact.altAddressLine2 !== undefined) dbContact.alt_address_line_2 = contact.altAddressLine2;
  if (contact.altAddressLine3 !== undefined) dbContact.alt_address_line_3 = contact.altAddressLine3;
  if (contact.altCity !== undefined) dbContact.alt_city = contact.altCity;
  if (contact.altState !== undefined) dbContact.alt_state = contact.altState;
  if (contact.altPostalCode !== undefined) dbContact.alt_postal_code = contact.altPostalCode;
  if (contact.altCountry !== undefined) dbContact.alt_country = contact.altCountry ?? null;
  if (contact.mailingPreference !== undefined) dbContact.mailing_preference = contact.mailingPreference;
  
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
