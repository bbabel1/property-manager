// TypeScript interfaces for the Ownerships table
// These match the database schema defined in the migration

// Database schema (snake_case) - Updated to match live database
export interface OwnershipDB {
  id: string;
  property_id: string;
  owner_id: string;
  primary: boolean;
  ownership_percentage: number;
  disbursement_percentage: number;
  created_at: string;
  updated_at: string;
}

// Application interface (camelCase) - Updated to match live database
export interface Ownership {
  id: string;
  propertyId: string;
  ownerId: string;
  primary: boolean;
  ownershipPercentage: number;
  disbursementPercentage: number;
  createdAt: string;
  updatedAt: string;
}

// Database to Application mapping
export function mapOwnershipFromDB(dbOwnership: OwnershipDB): Ownership {
  return {
    id: dbOwnership.id,
    propertyId: dbOwnership.property_id,
    ownerId: dbOwnership.owner_id,
    primary: dbOwnership.primary,
    ownershipPercentage: dbOwnership.ownership_percentage,
    disbursementPercentage: dbOwnership.disbursement_percentage,
    createdAt: dbOwnership.created_at,
    updatedAt: dbOwnership.updated_at,
  };
}

// Application to Database mapping
export function mapOwnershipToDB(ownership: Partial<Ownership>): Partial<OwnershipDB> {
  const dbOwnership: Partial<OwnershipDB> = {};
  
  if (ownership.propertyId !== undefined) dbOwnership.property_id = ownership.propertyId;
  if (ownership.ownerId !== undefined) dbOwnership.owner_id = ownership.ownerId;
  if (ownership.primary !== undefined) dbOwnership.primary = ownership.primary;
  if (ownership.ownershipPercentage !== undefined) dbOwnership.ownership_percentage = ownership.ownershipPercentage;
  if (ownership.disbursementPercentage !== undefined) dbOwnership.disbursement_percentage = ownership.disbursementPercentage;
  
  return dbOwnership;
}

export interface CreateOwnershipRequest {
  propertyId: string;
  ownerId: string;
  primary?: boolean;
  ownershipPercentage: number;
  disbursementPercentage: number;
}

export interface UpdateOwnershipRequest extends Partial<CreateOwnershipRequest> {
  id: string;
}

// Utility types for form handling
export interface OwnershipFormData {
  propertyId: string;
  ownerId: string;
  primary: boolean;
  ownershipPercentage: string;
  disbursementPercentage: string;
}

// Constants for form validation
export const OWNERSHIP_CONSTRAINTS = {
  ownershipPercentage: {
    min: 0,
    max: 100,
    required: true
  },
  disbursementPercentage: {
    min: 0,
    max: 100,
    required: true
  }
} as const;
