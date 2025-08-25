// TypeScript interfaces for the Staff table
// These match the database schema defined in the migration

export type StaffRoleEnum = 
  | 'PROPERTY_MANAGER'
  | 'ASSISTANT_PROPERTY_MANAGER'
  | 'MAINTENANCE_COORDINATOR'
  | 'ACCOUNTANT'
  | 'ADMINISTRATOR';

// Database schema (matches the actual table structure) - Updated to match live database
export interface StaffDB {
  id: number;
  role: StaffRoleEnum;
  isActive: boolean;
  buildium_user_id?: number;
  createdAt: string;
  updatedAt: string;
}

// Application interface (camelCase) - Updated to match live database
export interface Staff {
  id: number;
  role: StaffRoleEnum;
  isActive: boolean;
  buildiumUserId?: number;
  createdAt: string;
  updatedAt: string;
}

// Database to Application mapping
export function mapStaffFromDB(dbStaff: StaffDB): Staff {
  return {
    id: dbStaff.id,
    role: dbStaff.role,
    isActive: dbStaff.isActive,
    buildiumUserId: dbStaff.buildium_user_id,
    createdAt: dbStaff.createdAt,
    updatedAt: dbStaff.updatedAt,
  };
}

// Application to Database mapping
export function mapStaffToDB(staff: Partial<Staff>): Partial<StaffDB> {
  const dbStaff: Partial<StaffDB> = {};
  
  if (staff.role !== undefined) dbStaff.role = staff.role;
  if (staff.isActive !== undefined) dbStaff.isActive = staff.isActive;
  if (staff.buildiumUserId !== undefined) dbStaff.buildium_user_id = staff.buildiumUserId;
  
  return dbStaff;
}

export interface CreateStaffRequest {
  role?: StaffRoleEnum;
  isActive?: boolean;
  buildiumUserId?: number;
}

export interface UpdateStaffRequest extends Partial<CreateStaffRequest> {
  id: number;
}

// Utility types for form handling
export interface StaffFormData {
  role: StaffRoleEnum;
  isActive: boolean;
  buildiumUserId: string;
}

// Constants for form validation
export const STAFF_CONSTRAINTS = {
  buildiumUserId: {
    min: 1
  }
} as const;
