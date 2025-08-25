// TypeScript interfaces for the Owners table
// These match the database schema defined in the migration

// Database schema (snake_case) - Based on live database
export interface OwnerDB {
  id: string;
  contact_id: number;
  management_agreement_start_date?: string;
  management_agreement_end_date?: string;
  comment?: string;
  etf_account_type?: string;
  etf_account_number?: string;
  etf_routing_number?: string;
  created_at: string;
  updated_at: string;
}

// Application interface (camelCase)
export interface Owner {
  id: string;
  contactId: number;
  managementAgreementStartDate?: string;
  managementAgreementEndDate?: string;
  comment?: string;
  etfAccountType?: string;
  etfAccountNumber?: string;
  etfRoutingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// Database to Application mapping
export function mapOwnerFromDB(dbOwner: OwnerDB): Owner {
  return {
    id: dbOwner.id,
    contactId: dbOwner.contact_id,
    managementAgreementStartDate: dbOwner.management_agreement_start_date,
    managementAgreementEndDate: dbOwner.management_agreement_end_date,
    comment: dbOwner.comment,
    etfAccountType: dbOwner.etf_account_type,
    etfAccountNumber: dbOwner.etf_account_number,
    etfRoutingNumber: dbOwner.etf_routing_number,
    createdAt: dbOwner.created_at,
    updatedAt: dbOwner.updated_at,
  };
}

// Application to Database mapping
export function mapOwnerToDB(owner: Partial<Owner>): Partial<OwnerDB> {
  const dbOwner: Partial<OwnerDB> = {};
  
  if (owner.contactId !== undefined) dbOwner.contact_id = owner.contactId;
  if (owner.managementAgreementStartDate !== undefined) dbOwner.management_agreement_start_date = owner.managementAgreementStartDate;
  if (owner.managementAgreementEndDate !== undefined) dbOwner.management_agreement_end_date = owner.managementAgreementEndDate;
  if (owner.comment !== undefined) dbOwner.comment = owner.comment;
  if (owner.etfAccountType !== undefined) dbOwner.etf_account_type = owner.etfAccountType;
  if (owner.etfAccountNumber !== undefined) dbOwner.etf_account_number = owner.etfAccountNumber;
  if (owner.etfRoutingNumber !== undefined) dbOwner.etf_routing_number = owner.etfRoutingNumber;
  
  return dbOwner;
}

export interface CreateOwnerRequest {
  contactId: number;
  managementAgreementStartDate?: string;
  managementAgreementEndDate?: string;
  comment?: string;
  etfAccountType?: string;
  etfAccountNumber?: string;
  etfRoutingNumber?: string;
}

export interface UpdateOwnerRequest extends Partial<CreateOwnerRequest> {
  id: string;
}

// Utility types for form handling
export interface OwnerFormData {
  contactId: string;
  managementAgreementStartDate: string;
  managementAgreementEndDate: string;
  comment: string;
  etfAccountType: string;
  etfAccountNumber: string;
  etfRoutingNumber: string;
}

// Constants for form validation
export const OWNER_CONSTRAINTS = {
  contactId: {
    required: true
  },
  etfAccountNumber: {
    maxLength: 50
  },
  etfRoutingNumber: {
    maxLength: 20
  }
} as const;
