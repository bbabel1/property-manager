import type { Database } from '@/types/database'

// UI-friendly role names (what users see)
export type UIStaffRole = 
  | 'Property Manager'
  | 'Bookkeeper'
  | 'Assistant Property Manager'
  | 'Maintenance Coordinator'
  | 'Accountant'
  | 'Administrator'

// Database enum values (what gets stored)
export type DBStaffRole = Database['public']['Enums']['staff_role']

// Mapping from UI roles to database enum values
export const UI_TO_DB_ROLE_MAPPING: Record<UIStaffRole, DBStaffRole> = {
  'Property Manager': 'PROPERTY_MANAGER',
  'Bookkeeper': 'ACCOUNTANT',
  'Assistant Property Manager': 'ASSISTANT_PROPERTY_MANAGER',
  'Maintenance Coordinator': 'MAINTENANCE_COORDINATOR',
  'Accountant': 'ACCOUNTANT',
  'Administrator': 'ADMINISTRATOR'
} as const

// Reverse mapping from database enum to UI role
export const DB_TO_UI_ROLE_MAPPING: Record<DBStaffRole, UIStaffRole> = {
  'PROPERTY_MANAGER': 'Property Manager',
  'ASSISTANT_PROPERTY_MANAGER': 'Assistant Property Manager',
  'MAINTENANCE_COORDINATOR': 'Maintenance Coordinator',
  'ACCOUNTANT': 'Accountant',
  'ADMINISTRATOR': 'Administrator'
} as const

/**
 * Convert UI role string to database enum value
 * @param uiRole - The UI-friendly role name
 * @returns The corresponding database enum value
 */
export function mapUIStaffRoleToDB(uiRole: string): DBStaffRole {
  const normalizedRole = uiRole.trim() as UIStaffRole
  const dbRole = UI_TO_DB_ROLE_MAPPING[normalizedRole]
  
  if (!dbRole) {
    console.warn(`Unknown UI staff role: "${uiRole}", defaulting to PROPERTY_MANAGER`)
    return 'PROPERTY_MANAGER'
  }
  
  return dbRole
}

/**
 * Convert database enum value to UI role string
 * @param dbRole - The database enum value
 * @returns The UI-friendly role name
 */
export function mapDBStaffRoleToUI(dbRole: DBStaffRole): UIStaffRole {
  const uiRole = DB_TO_UI_ROLE_MAPPING[dbRole]
  
  if (!uiRole) {
    console.warn(`Unknown DB staff role: "${dbRole}", defaulting to Property Manager`)
    return 'Property Manager'
  }
  
  return uiRole
}

/**
 * Validate if a string is a valid UI staff role
 * @param role - The role string to validate
 * @returns True if valid UI role
 */
export function isValidUIStaffRole(role: string): role is UIStaffRole {
  return role in UI_TO_DB_ROLE_MAPPING
}

/**
 * Validate if a string is a valid database staff role
 * @param role - The role string to validate
 * @returns True if valid DB role
 */
export function isValidDBStaffRole(role: string): role is DBStaffRole {
  return role in DB_TO_UI_ROLE_MAPPING
}

/**
 * Get all available UI staff roles
 * @returns Array of UI staff role strings
 */
export function getAvailableUIStaffRoles(): UIStaffRole[] {
  return Object.keys(UI_TO_DB_ROLE_MAPPING) as UIStaffRole[]
}

/**
 * Get all available database staff roles
 * @returns Array of database staff role enum values
 */
export function getAvailableDBStaffRoles(): DBStaffRole[] {
  return Object.keys(DB_TO_UI_ROLE_MAPPING) as DBStaffRole[]
}
