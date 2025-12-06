import type { Database } from '@/types/database'

// UI-friendly role names (what users see)
export type UIStaffRole =
  | 'Property Manager'
  | 'Assistant Property Manager'
  | 'Maintenance Coordinator'
  | 'Accountant'
  | 'Administrator'
  | 'Bookkeeper'

// Database enum values (what gets stored)
export type DBStaffRole = Database['public']['Enums']['staff_roles']

// Canonical ordered list for UI pickers and validators
export const STAFF_ROLE_VALUES: UIStaffRole[] = [
  'Property Manager',
  'Assistant Property Manager',
  'Maintenance Coordinator',
  'Accountant',
  'Administrator',
  'Bookkeeper',
]

// Mapping from UI roles to database enum values (1:1 when using staff_roles enum)
export const UI_TO_DB_ROLE_MAPPING: Record<UIStaffRole, DBStaffRole> = {
  'Property Manager': 'Property Manager',
  'Assistant Property Manager': 'Assistant Property Manager',
  'Maintenance Coordinator': 'Maintenance Coordinator',
  'Accountant': 'Accountant',
  'Administrator': 'Administrator',
  'Bookkeeper': 'Bookkeeper',
} as const

// Reverse mapping from database enum to UI role
export const DB_TO_UI_ROLE_MAPPING: Record<DBStaffRole, UIStaffRole> = {
  'Property Manager': 'Property Manager',
  'Assistant Property Manager': 'Assistant Property Manager',
  'Maintenance Coordinator': 'Maintenance Coordinator',
  'Accountant': 'Accountant',
  'Administrator': 'Administrator',
  'Bookkeeper': 'Bookkeeper',
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
    console.warn(`Unknown UI staff role: "${uiRole}", defaulting to Property Manager`)
    return 'Property Manager'
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
  return STAFF_ROLE_VALUES
}

/**
 * Get all available database staff roles
 * @returns Array of database staff role enum values
 */
export function getAvailableDBStaffRoles(): DBStaffRole[] {
  return STAFF_ROLE_VALUES as DBStaffRole[]
}
